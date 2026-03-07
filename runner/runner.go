// Package runner manages headless Claude Code executions for queued tasks.
package runner

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"

	"aiworkbench/store"
)

// Runner dispatches queued tasks to Claude Code running headlessly.
type Runner struct {
	store    *store.Store
	notify   func()
	writeMCP func(projectPath string) error

	mu       sync.Mutex
	projects map[int64]*projectRunner
}

type projectRunner struct {
	cancel context.CancelFunc
	done   <-chan struct{}
}

// New creates a Runner.
// notify is called after any status change (triggers board:changed event).
// writeMCP writes the .mcp.json to a project directory so Claude can reach our server.
func New(s *store.Store, notify func(), writeMCP func(string) error) *Runner {
	return &Runner{
		store:    s,
		notify:   notify,
		writeMCP: writeMCP,
		projects: make(map[int64]*projectRunner),
	}
}

// Start begins the dispatch loop for a project (no-op if already running).
func (r *Runner) Start(projectID int64) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.projects[projectID]; ok {
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	r.projects[projectID] = &projectRunner{cancel: cancel, done: done}

	go func() {
		defer close(done)
		r.dispatchLoop(ctx, projectID)
	}()
}

// Stop halts the dispatch loop for a project.
func (r *Runner) Stop(projectID int64) {
	r.mu.Lock()
	pr, ok := r.projects[projectID]
	if ok {
		pr.cancel()
		delete(r.projects, projectID)
	}
	r.mu.Unlock()
}

// IsRunning reports whether a dispatch loop is active for the given project.
func (r *Runner) IsRunning(projectID int64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.projects[projectID]
	return ok
}

// StopAll halts all dispatch loops (called on app shutdown).
func (r *Runner) StopAll() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, pr := range r.projects {
		pr.cancel()
	}
	r.projects = make(map[int64]*projectRunner)
}

func (r *Runner) dispatchLoop(ctx context.Context, projectID int64) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	// Try immediately on start
	r.processNext(ctx, projectID)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.processNext(ctx, projectID)
		}
	}
}

func (r *Runner) processNext(ctx context.Context, projectID int64) {
	item, err := r.store.NextPendingQueueItem(projectID)
	if err != nil || item == nil {
		return
	}

	var prompt, projectPath string

	if item.TaskID != nil {
		task, err := r.store.GetTask(*item.TaskID)
		if err != nil {
			log.Printf("runner: get task %d: %v", *item.TaskID, err)
			return
		}
		project, err := r.store.GetProject(task.ProjectID)
		if err != nil {
			log.Printf("runner: get project for task %d: %v", *item.TaskID, err)
			return
		}
		prompt = task.Prompt
		projectPath = project.Path
		_ = r.store.UpdateTaskStatus(*item.TaskID, "running")
	} else if item.SubtaskID != nil {
		subtask, err := r.store.GetSubtask(*item.SubtaskID)
		if err != nil {
			log.Printf("runner: get subtask %d: %v", *item.SubtaskID, err)
			return
		}
		task, err := r.store.GetTask(subtask.TaskID)
		if err != nil {
			log.Printf("runner: get task for subtask %d: %v", *item.SubtaskID, err)
			return
		}
		project, err := r.store.GetProject(task.ProjectID)
		if err != nil {
			log.Printf("runner: get project for subtask %d: %v", *item.SubtaskID, err)
			return
		}
		prompt = subtask.Prompt
		projectPath = project.Path
		_ = r.store.UpdateSubtaskStatus(*item.SubtaskID, "running")
	}

	if prompt == "" {
		_ = r.store.FinishQueueItem(item.ID, "failed", "", "task has no prompt")
		r.notify()
		return
	}

	// Verify all dependencies are done before executing.
	var depMsg string
	if item.TaskID != nil {
		depMsg, _ = r.store.CheckTaskDepsComplete(*item.TaskID)
	} else if item.SubtaskID != nil {
		depMsg, _ = r.store.CheckSubtaskDepsComplete(*item.SubtaskID)
	}
	if depMsg != "" {
		_ = r.store.FinishQueueItem(item.ID, "failed", "", depMsg)
		r.notify()
		return
	}

	_ = r.store.UpdateQueueItemStatus(item.ID, "running")
	r.notify()

	if r.writeMCP != nil {
		if err := r.writeMCP(projectPath); err != nil {
			log.Printf("runner: write mcp config for %s: %v", projectPath, err)
		}
	}

	output, runErr := r.runClaude(ctx, projectPath, prompt)

	// If the runner was stopped mid-execution, revert to pending so it can be retried.
	if ctx.Err() != nil {
		_ = r.store.UpdateQueueItemStatus(item.ID, "pending")
		if item.TaskID != nil {
			_ = r.store.UpdateTaskStatus(*item.TaskID, "queued")
		} else if item.SubtaskID != nil {
			_ = r.store.UpdateSubtaskStatus(*item.SubtaskID, "queued")
		}
		r.notify()
		return
	}

	finalStatus := "done"
	errMsg := ""
	if runErr != nil {
		finalStatus = "failed"
		errMsg = runErr.Error()
	}

	_ = r.store.FinishQueueItem(item.ID, finalStatus, output, errMsg)

	if item.TaskID != nil {
		_ = r.store.UpdateTaskStatus(*item.TaskID, finalStatus)
	} else if item.SubtaskID != nil {
		_ = r.store.UpdateSubtaskStatus(*item.SubtaskID, finalStatus)
	}

	r.notify()
}

func (r *Runner) runClaude(ctx context.Context, dir, prompt string) (string, error) {
	cmd := exec.CommandContext(ctx, "claude", "-p", prompt)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "NO_COLOR=1", "FORCE_COLOR=0")

	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	if err := cmd.Run(); err != nil {
		return out.String(), fmt.Errorf("claude: %w", err)
	}
	return out.String(), nil
}
