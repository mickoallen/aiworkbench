// Package runner manages headless Claude Code executions for queued tasks.
package runner

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"aiworkbench/store"
)

const defaultModel = "claude-sonnet-4-6"

// Runner dispatches queued tasks to Claude Code running headlessly.
type Runner struct {
	store           *store.Store
	notify          func()
	writeMCP        func(projectPath string) error
	writeOpencodeMCP func(projectPath string) error
	onOutput        func(queueItemID int64, data string)

	mu       sync.Mutex
	projects map[int64]*projectRunner
}

type projectRunner struct {
	cancel context.CancelFunc
	done   <-chan struct{}
	halted bool   // true when halted due to failure
	reason string // failure reason when halted
}

// New creates a Runner.
// notify is called after any status change (triggers board:changed event).
// writeMCP writes the .mcp.json to a project directory so Claude can reach our server.
// onOutput is called with streaming output chunks during execution.
func New(s *store.Store, notify func(), writeMCP func(string) error, writeOpencodeMCP func(string) error, onOutput func(int64, string)) *Runner {
	return &Runner{
		store:           s,
		notify:          notify,
		writeMCP:        writeMCP,
		writeOpencodeMCP: writeOpencodeMCP,
		onOutput:        onOutput,
		projects:        make(map[int64]*projectRunner),
	}
}

// Start begins the dispatch loop for a project (no-op if already running).
func (r *Runner) Start(projectID int64) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if pr, ok := r.projects[projectID]; ok {
		// If halted, clear halt and resume.
		if pr.halted {
			pr.halted = false
			pr.reason = ""
		}
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	r.projects[projectID] = &projectRunner{cancel: cancel, done: done}

	// Recover any items stuck in "running" from a prior crash.
	r.store.RecoverStaleRunning(projectID)

	go func() {
		defer close(done)
		r.dispatchLoop(ctx, projectID)
	}()
}

// Stop halts the dispatch loop for a project and reverts pending queue items.
func (r *Runner) Stop(projectID int64) {
	r.mu.Lock()
	pr, ok := r.projects[projectID]
	if ok {
		pr.cancel()
		delete(r.projects, projectID)
	}
	r.mu.Unlock()

	if ok {
		// Wait for the current execution to finish reverting, then revert all pending items.
		<-pr.done
		r.store.RevertPendingQueueItems(projectID)
		r.notify()
	}
}

// IsRunning reports whether a dispatch loop is active for the given project.
func (r *Runner) IsRunning(projectID int64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.projects[projectID]
	return ok
}

// IsHalted reports whether the runner is halted due to a failure.
func (r *Runner) IsHalted(projectID int64) (bool, string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	pr, ok := r.projects[projectID]
	if !ok {
		return false, ""
	}
	return pr.halted, pr.reason
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

func (r *Runner) halt(projectID int64, reason string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if pr, ok := r.projects[projectID]; ok {
		pr.halted = true
		pr.reason = reason
		log.Printf("runner: halted for project %d: %s", projectID, reason)
	}
}

func (r *Runner) isHaltedInternal(projectID int64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	pr, ok := r.projects[projectID]
	return ok && pr.halted
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
			if !r.isHaltedInternal(projectID) {
				r.processNext(ctx, projectID)
			}
		}
	}
}

func (r *Runner) failItem(item *store.QueueItem, errMsg string) {
	_ = r.store.FinishQueueItem(item.ID, "failed", "", errMsg)
	if item.TaskID != nil {
		_ = r.store.UpdateTaskStatus(*item.TaskID, "failed")
	} else if item.SubtaskID != nil {
		_ = r.store.UpdateSubtaskStatus(*item.SubtaskID, "failed")
	}
	r.store.CascadeFailure(item.ProjectID)
}

func (r *Runner) processNext(ctx context.Context, projectID int64) {
	item, err := r.store.NextPendingQueueItem(projectID)
	if err != nil || item == nil {
		return
	}

	var prompt, projectPath, model, agent, itemName string

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
		model = task.Model
		agent = task.Agent
		if model == "" {
			model = defaultModel
		}
		itemName = task.Name
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
		model = subtask.Model
		agent = subtask.Agent
		if model == "" {
			model = defaultModel
		}
		itemName = subtask.Name
		_ = r.store.UpdateSubtaskStatus(*item.SubtaskID, "running")
	}

	if agent == "" {
		agent = "claude"
	}

	if prompt == "" {
		r.failItem(item, "task has no prompt")
		r.halt(projectID, fmt.Sprintf("%q failed: task has no prompt", itemName))
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
		r.failItem(item, depMsg)
		r.halt(projectID, fmt.Sprintf("%q failed: %s", itemName, depMsg))
		r.notify()
		return
	}

	_ = r.store.UpdateQueueItemStatus(item.ID, "running")
	r.notify()

	// Write MCP config so the agent can reach our server.
	switch agent {
	case "opencode":
		if r.writeOpencodeMCP != nil {
			if err := r.writeOpencodeMCP(projectPath); err != nil {
				log.Printf("runner: write opencode mcp config for %s: %v", projectPath, err)
			}
		}
	default:
		if r.writeMCP != nil {
			if err := r.writeMCP(projectPath); err != nil {
				log.Printf("runner: write mcp config for %s: %v", projectPath, err)
			}
		}
	}

	log.Printf("runner: executing %q (agent=%s, model=%s) in %s", itemName, agent, model, projectPath)
	output, runErr := r.runAgent(ctx, item.ID, projectPath, prompt, model, agent)

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
		log.Printf("runner: %q failed: %v", itemName, runErr)
	} else {
		log.Printf("runner: %q completed", itemName)
	}

	_ = r.store.FinishQueueItem(item.ID, finalStatus, output, errMsg)

	if item.TaskID != nil {
		_ = r.store.UpdateTaskStatus(*item.TaskID, finalStatus)
	} else if item.SubtaskID != nil {
		_ = r.store.UpdateSubtaskStatus(*item.SubtaskID, finalStatus)
	}

	// On failure: cascade — purge dependent pending items whose deps are no longer met.
	if finalStatus == "failed" {
		r.store.CascadeFailure(projectID)
		r.halt(projectID, fmt.Sprintf("%q failed", itemName))
	}

	r.notify()
}

// streamWriter wraps a callback to implement io.Writer for streaming output.
type streamWriter struct {
	fn func(data string)
}

func (w *streamWriter) Write(p []byte) (int, error) {
	w.fn(string(p))
	return len(p), nil
}

func (r *Runner) runAgent(ctx context.Context, queueItemID int64, dir, prompt, model, agent string) (string, error) {
	switch agent {
	case "opencode":
		return r.runOpencode(ctx, queueItemID, dir, prompt, model)
	default:
		return r.runClaude(ctx, queueItemID, dir, prompt, model)
	}
}

func (r *Runner) runOpencode(ctx context.Context, queueItemID int64, dir, prompt, model string) (string, error) {
	args := []string{"run"}
	if model != "" {
		args = append(args, "--model", model)
	}
	args = append(args, prompt)

	log.Printf("runner: opencode run (model=%s)", model)

	cmd := exec.CommandContext(ctx, "opencode", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "NO_COLOR=1")

	var out bytes.Buffer
	var w io.Writer = &out
	if r.onOutput != nil {
		w = io.MultiWriter(&out, &streamWriter{fn: func(data string) {
			r.onOutput(queueItemID, data)
		}})
	}
	cmd.Stdout = w
	cmd.Stderr = w

	if err := cmd.Run(); err != nil {
		return out.String(), fmt.Errorf("opencode: %w\noutput: %s", err, out.String())
	}
	return out.String(), nil
}

func (r *Runner) runClaude(ctx context.Context, queueItemID int64, dir, prompt, model string) (string, error) {
	mcpConfigPath := filepath.Join(dir, ".mcp.json")

	args := []string{
		"-p", prompt,
		"--model", model,
		"--dangerously-skip-permissions",
	}

	// Point Claude at our MCP config if it exists.
	if _, err := os.Stat(mcpConfigPath); err == nil {
		args = append(args, "--mcp-config", mcpConfigPath)
	}

	log.Printf("runner: claude %v", args[:4]) // log first few args (prompt may be long)

	cmd := exec.CommandContext(ctx, "claude", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "NO_COLOR=1", "FORCE_COLOR=0")

	var out bytes.Buffer
	// Stream output to both buffer and frontend callback.
	var w io.Writer = &out
	if r.onOutput != nil {
		w = io.MultiWriter(&out, &streamWriter{fn: func(data string) {
			r.onOutput(queueItemID, data)
		}})
	}
	cmd.Stdout = w
	cmd.Stderr = w

	if err := cmd.Run(); err != nil {
		return out.String(), fmt.Errorf("claude: %w\noutput: %s", err, out.String())
	}
	return out.String(), nil
}
