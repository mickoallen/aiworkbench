package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"aiworkbench/db"
	"aiworkbench/mcp"
	"aiworkbench/runner"
	"aiworkbench/store"
	ptymanager "aiworkbench/pty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the main application struct bound to Wails.
type App struct {
	ctx       context.Context
	store     *store.Store
	mcpServer *mcp.Server
	pty       *ptymanager.Manager
	runner    *runner.Runner
}

func NewApp() *App {
	return &App{
		pty: ptymanager.New(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	database, err := db.Open()
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	a.store = store.New(database)

	mcpSrv, err := mcp.New(a.store)
	if err != nil {
		log.Fatalf("failed to start MCP server: %v", err)
	}
	mcpSrv.OnDataChange(func() {
		runtime.EventsEmit(a.ctx, "board:changed")
	})
	a.mcpServer = mcpSrv

	// Recover stale state from prior crashes.
	a.store.CleanupOrphanQueueItems()
	if projects, err := a.store.ListProjects(); err == nil {
		for _, p := range projects {
			a.store.RecoverStaleRunning(p.ID)
		}
	}

	notify := func() { runtime.EventsEmit(a.ctx, "board:changed") }
	onOutput := func(queueItemID int64, data string) {
		runtime.EventsEmit(a.ctx, "runner:output", queueItemID, data)
	}
	executorPrompt := func() string {
		v, _ := a.store.GetSetting("executor_system_prompt")
		return v
	}
	a.runner = runner.New(a.store, notify, a.writeMCPConfig, func(p string) error { return a.writeOpencodeMCPConfig(p, "") }, onOutput, executorPrompt)
}

func (a *App) shutdown(ctx context.Context) {
	a.pty.Stop()
	if a.runner != nil {
		a.runner.StopAll()
	}
	if a.mcpServer != nil {
		a.mcpServer.Close()
	}
}

// ---- PTY ----

func (a *App) PTYStart(cols, rows int) error {
	return a.pty.Start(a.ctx, "claude", []string{}, uint16(cols), uint16(rows))
}

// PTYStartInProject spawns an AI agent in the given project directory.
// systemPrompt is injected via agent-specific config so it applies to the interactive session.
func (a *App) PTYStartInProject(projectPath string, cols, rows int, agent, systemPrompt string) error {
	if agent == "" {
		agent = "claude"
	}
	if agent == "claude" {
		if err := a.writeMCPConfig(projectPath); err != nil {
			log.Printf("warning: could not write .mcp.json: %v", err)
		}
		if err := a.writeCoordinatorPrompt(projectPath, systemPrompt); err != nil {
			log.Printf("warning: could not write coordinator settings: %v", err)
		}
	} else if agent == "opencode" {
		if err := a.writeOpencodeMCPConfig(projectPath, systemPrompt); err != nil {
			log.Printf("warning: could not write opencode.json MCP config: %v", err)
		}
	}

	return a.pty.StartInDir(a.ctx, agent, []string{}, projectPath, uint16(cols), uint16(rows))
}

// writeCoordinatorPrompt ensures .claude/settings.json exists with auto-allow for MCP tools
// and optionally sets a systemPrompt for the interactive session.
func (a *App) writeCoordinatorPrompt(projectPath, systemPrompt string) error {
	dir := filepath.Join(projectPath, ".claude")
	settingsPath := filepath.Join(dir, "settings.json")

	// Read existing settings if present
	var settings map[string]any
	if data, err := os.ReadFile(settingsPath); err == nil {
		if err := json.Unmarshal(data, &settings); err != nil {
			settings = nil
		}
	}
	if settings == nil {
		settings = make(map[string]any)
	}

	// Ensure permissions.allow contains "mcp__aiworkbench"
	perms, _ := settings["permissions"].(map[string]any)
	if perms == nil {
		perms = make(map[string]any)
		settings["permissions"] = perms
	}
	allow, _ := perms["allow"].([]any)
	found := false
	for _, v := range allow {
		if s, ok := v.(string); ok && s == "mcp__aiworkbench" {
			found = true
			break
		}
	}
	if !found {
		allow = append(allow, "mcp__aiworkbench")
		perms["allow"] = allow
	}

	if systemPrompt != "" {
		settings["systemPrompt"] = systemPrompt
	} else {
		delete(settings, "systemPrompt")
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(settingsPath, data, 0644)
}

// writeOpencodeMCPConfig ensures opencode.json in the project dir has our MCP server,
// and writes the system prompt to .opencode/aiworkbench-instructions.md if provided.
func (a *App) writeOpencodeMCPConfig(projectPath, systemPrompt string) error {
	// Write system prompt file if set, delete it if blank.
	instrDir := filepath.Join(projectPath, ".opencode")
	instrFile := filepath.Join(instrDir, "aiworkbench-instructions.md")
	instrRef := ".opencode/aiworkbench-instructions.md"

	if systemPrompt != "" {
		if err := os.MkdirAll(instrDir, 0755); err != nil {
			return err
		}
		if err := os.WriteFile(instrFile, []byte(systemPrompt), 0644); err != nil {
			return err
		}
	} else {
		_ = os.Remove(instrFile)
	}

	cfgPath := filepath.Join(projectPath, "opencode.json")

	var cfg map[string]any
	if data, err := os.ReadFile(cfgPath); err == nil {
		if err := json.Unmarshal(data, &cfg); err != nil {
			cfg = nil
		}
	}
	if cfg == nil {
		cfg = make(map[string]any)
	}

	// MCP server entry.
	mcpSection, _ := cfg["mcp"].(map[string]any)
	if mcpSection == nil {
		mcpSection = make(map[string]any)
		cfg["mcp"] = mcpSection
	}
	mcpSection["aiworkbench"] = map[string]any{
		"type":    "remote",
		"url":     "http://" + a.mcpServer.Addr() + "/mcp",
		"enabled": true,
	}

	// Only manage the instructions entry when we have a prompt to set.
	// When systemPrompt is empty (e.g. runner path), leave instructions untouched.
	if systemPrompt != "" {
		rawInstrs, _ := cfg["instructions"].([]any)
		instrs := []any{}
		for _, v := range rawInstrs {
			if s, ok := v.(string); ok && s != instrRef {
				instrs = append(instrs, s)
			}
		}
		instrs = append(instrs, instrRef)
		cfg["instructions"] = instrs
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(cfgPath, data, 0644)
}

func (a *App) writeMCPConfig(projectPath string) error {
	cfg := map[string]any{
		"mcpServers": map[string]any{
			"aiworkbench": map[string]any{
				"type": "http",
				"url":  "http://" + a.mcpServer.Addr() + "/mcp",
			},
		},
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(projectPath, ".mcp.json"), data, 0644)
}

func (a *App) PTYStop() {
	a.pty.Stop()
}

func (a *App) PTYWrite(data string) error {
	return a.pty.Write(data)
}

func (a *App) PTYResize(cols, rows int) error {
	return a.pty.Resize(uint16(cols), uint16(rows))
}

func (a *App) PTYRunning() bool {
	return a.pty.Running()
}

// OpenTerminal writes .mcp.json to the project directory then opens a new
// Terminal.app window running `claude` in that directory.
func (a *App) OpenTerminal(projectPath string) error {
	if err := a.writeMCPConfig(projectPath); err != nil {
		log.Printf("warning: could not write .mcp.json: %v", err)
	}
	// Single-quote the path and escape any embedded single-quotes.
	escaped := strings.ReplaceAll(projectPath, "'", `'\''`)
	script := fmt.Sprintf(`tell application "Terminal"
		do script "cd '%s' && claude"
		activate
	end tell`, escaped)
	return exec.Command("osascript", "-e", script).Run()
}

// ---- Dialogs ----

func (a *App) OpenDirDialog() string {
	path, _ := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Project Directory",
	})
	return path
}

// ---- MCP ----

func (a *App) MCPAddr() string {
	if a.mcpServer == nil {
		return ""
	}
	return a.mcpServer.Addr()
}

// ---- Projects ----

func (a *App) CreateProject(name, path, description string) (*store.Project, error) {
	return a.store.CreateProject(name, path, description)
}

func (a *App) GetProject(id int64) (*store.Project, error) {
	return a.store.GetProject(id)
}

func (a *App) ListProjects() ([]store.Project, error) {
	return a.store.ListProjects()
}

func (a *App) UpdateProject(id int64, name, description, sessionBranch string) (*store.Project, error) {
	return a.store.UpdateProject(id, name, description, sessionBranch)
}

func (a *App) DeleteProject(id int64) error {
	return a.store.DeleteProject(id)
}

// ---- Tasks ----

func (a *App) CreateTask(projectID int64, name, objective, taskType, prompt, model, agent string, canvasX, canvasY float64) (*store.Task, error) {
	return a.store.CreateTask(projectID, name, objective, taskType, prompt, model, agent, canvasX, canvasY)
}

func (a *App) GetTask(id int64) (*store.Task, error) {
	return a.store.GetTask(id)
}

func (a *App) ListTasks(projectID int64) ([]store.Task, error) {
	return a.store.ListTasks(projectID)
}

func (a *App) UpdateTask(id int64, name, objective, prompt, model, agent, status string) (*store.Task, error) {
	return a.store.UpdateTask(id, name, objective, prompt, model, agent, status)
}

func (a *App) UpdateTaskStatus(id int64, status string) error {
	return a.store.UpdateTaskStatus(id, status)
}

func (a *App) UpdateTaskPosition(id int64, x, y float64) error {
	return a.store.UpdateTaskPosition(id, x, y)
}

func (a *App) DeleteTask(id int64) error {
	return a.store.DeleteTask(id)
}

// ---- Subtasks ----

func (a *App) CreateSubtask(taskID int64, name, objective, prompt, model, agent string) (*store.Subtask, error) {
	return a.store.CreateSubtask(taskID, name, objective, prompt, model, agent)
}

func (a *App) GetSubtask(id int64) (*store.Subtask, error) {
	return a.store.GetSubtask(id)
}

func (a *App) ListSubtasks(taskID int64) ([]store.Subtask, error) {
	return a.store.ListSubtasks(taskID)
}

func (a *App) UpdateSubtask(id int64, name, objective, prompt, model, agent, status string) (*store.Subtask, error) {
	return a.store.UpdateSubtask(id, name, objective, prompt, model, agent, status)
}

func (a *App) UpdateSubtaskStatus(id int64, status string) error {
	return a.store.UpdateSubtaskStatus(id, status)
}

func (a *App) DeleteSubtask(id int64) error {
	return a.store.DeleteSubtask(id)
}

// ---- Subtask Dependencies ----

func (a *App) AddSubtaskDependency(subtaskID, dependsOnID int64) error {
	return a.store.AddSubtaskDependency(subtaskID, dependsOnID)
}

func (a *App) RemoveSubtaskDependency(subtaskID, dependsOnID int64) error {
	return a.store.RemoveSubtaskDependency(subtaskID, dependsOnID)
}

func (a *App) ListSubtaskDependencies(taskID int64) ([]store.SubtaskDependency, error) {
	return a.store.ListSubtaskDependencies(taskID)
}

// ---- Dependencies ----

func (a *App) AddDependency(taskID, dependsOnID int64) error {
	return a.store.AddDependency(taskID, dependsOnID)
}

func (a *App) RemoveDependency(taskID, dependsOnID int64) error {
	return a.store.RemoveDependency(taskID, dependsOnID)
}

func (a *App) ListDependencies(projectID int64) ([]store.TaskDependency, error) {
	return a.store.ListDependencies(projectID)
}

// ---- Queue ----

func (a *App) AddTaskToQueue(projectID, taskID int64) (*store.QueueItem, error) {
	return a.store.AddToQueue(projectID, &taskID, nil)
}

func (a *App) AddSubtaskToQueue(projectID, subtaskID int64) (*store.QueueItem, error) {
	return a.store.AddToQueue(projectID, nil, &subtaskID)
}

func (a *App) AddTaskToQueueWithDeps(projectID, taskID int64) error {
	err := a.store.AddTaskToQueueWithDeps(projectID, taskID)
	if err == nil {
		runtime.EventsEmit(a.ctx, "board:changed")
	}
	return err
}

func (a *App) AddSubtaskToQueueWithDeps(projectID, subtaskID int64) error {
	err := a.store.AddSubtaskToQueueWithDeps(projectID, subtaskID)
	if err == nil {
		runtime.EventsEmit(a.ctx, "board:changed")
	}
	return err
}

func (a *App) QueueContainerSubtasks(projectID, taskID int64) error {
	err := a.store.QueueContainerSubtasks(projectID, taskID)
	if err == nil {
		runtime.EventsEmit(a.ctx, "board:changed")
	}
	return err
}

func (a *App) RemoveFromQueueCascade(id int64) error {
	err := a.store.RemoveFromQueueCascade(id)
	if err == nil {
		runtime.EventsEmit(a.ctx, "board:changed")
	}
	return err
}

func (a *App) DequeueTask(projectID, taskID int64) error {
	err := a.store.DequeueTask(projectID, taskID)
	if err == nil {
		runtime.EventsEmit(a.ctx, "board:changed")
	}
	return err
}

func (a *App) DequeueSubtask(projectID, subtaskID int64) error {
	err := a.store.DequeueSubtask(projectID, subtaskID)
	if err == nil {
		runtime.EventsEmit(a.ctx, "board:changed")
	}
	return err
}

func (a *App) DequeueContainerSubtasks(projectID, taskID int64) error {
	err := a.store.DequeueContainerSubtasks(projectID, taskID)
	if err == nil {
		runtime.EventsEmit(a.ctx, "board:changed")
	}
	return err
}

func (a *App) ListQueue(projectID int64) ([]store.QueueItem, error) {
	return a.store.ListQueue(projectID)
}

func (a *App) RemoveFromQueue(id int64) error {
	return a.store.RemoveFromQueue(id)
}

func (a *App) ReorderQueue(projectID int64, ids []int64) error {
	return a.store.ReorderQueue(projectID, ids)
}

func (a *App) GetQueueItemForSubtask(subtaskID int64) (*store.QueueItem, error) {
	return a.store.GetQueueItemForSubtask(subtaskID)
}

func (a *App) GetQueueItemForTask(taskID int64) (*store.QueueItem, error) {
	return a.store.GetQueueItemForTask(taskID)
}

// ---- Runner ----

func (a *App) RunnerStart(projectID int64) {
	a.runner.Start(projectID)
	runtime.EventsEmit(a.ctx, "board:changed")
}

func (a *App) RunnerStop(projectID int64) {
	a.runner.Stop(projectID)
}

func (a *App) RunnerStatus(projectID int64) bool {
	return a.runner.IsRunning(projectID)
}

// RunnerHaltedReason returns the halt reason if halted, or empty string if not.
func (a *App) RunnerHaltedReason(projectID int64) string {
	halted, reason := a.runner.IsHalted(projectID)
	if halted {
		return reason
	}
	return ""
}

// RetryQueueItem resets a failed queue item to pending and clears the halt.
// ---- Settings ----

func (a *App) GetSetting(key string) (string, error) {
	return a.store.GetSetting(key)
}

func (a *App) SetSetting(key, value string) error {
	return a.store.SetSetting(key, value)
}

func (a *App) ListSettings() (map[string]string, error) {
	return a.store.ListSettings()
}

// ---- Window ----

func (a *App) SetWindowTitle(title string) {
	runtime.WindowSetTitle(a.ctx, title)
}

func (a *App) RetryQueueItem(id int64, projectID int64) error {
	err := a.store.RetryQueueItem(id)
	if err != nil {
		return err
	}
	// Clear halt so the runner resumes processing.
	a.runner.Start(projectID)
	runtime.EventsEmit(a.ctx, "board:changed")
	return nil
}
