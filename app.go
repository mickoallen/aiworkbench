package main

import (
	"context"
	"log"

	"aiworkbench/db"
	"aiworkbench/mcp"
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
	a.mcpServer = mcpSrv
}

func (a *App) shutdown(ctx context.Context) {
	a.pty.Stop()
	if a.mcpServer != nil {
		a.mcpServer.Close()
	}
}

// ---- PTY ----

func (a *App) PTYStart(cols, rows int) error {
	return a.pty.Start(a.ctx, "claude", []string{}, uint16(cols), uint16(rows))
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

func (a *App) CreateTask(projectID int64, name, objective, taskType, prompt string, canvasX, canvasY float64) (*store.Task, error) {
	return a.store.CreateTask(projectID, name, objective, taskType, prompt, canvasX, canvasY)
}

func (a *App) GetTask(id int64) (*store.Task, error) {
	return a.store.GetTask(id)
}

func (a *App) ListTasks(projectID int64) ([]store.Task, error) {
	return a.store.ListTasks(projectID)
}

func (a *App) UpdateTask(id int64, name, objective, prompt, status string) (*store.Task, error) {
	return a.store.UpdateTask(id, name, objective, prompt, status)
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

func (a *App) CreateSubtask(taskID int64, name, objective, prompt string) (*store.Subtask, error) {
	return a.store.CreateSubtask(taskID, name, objective, prompt)
}

func (a *App) GetSubtask(id int64) (*store.Subtask, error) {
	return a.store.GetSubtask(id)
}

func (a *App) ListSubtasks(taskID int64) ([]store.Subtask, error) {
	return a.store.ListSubtasks(taskID)
}

func (a *App) UpdateSubtask(id int64, name, objective, prompt, status string) (*store.Subtask, error) {
	return a.store.UpdateSubtask(id, name, objective, prompt, status)
}

func (a *App) UpdateSubtaskStatus(id int64, status string) error {
	return a.store.UpdateSubtaskStatus(id, status)
}

func (a *App) DeleteSubtask(id int64) error {
	return a.store.DeleteSubtask(id)
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

func (a *App) ListQueue(projectID int64) ([]store.QueueItem, error) {
	return a.store.ListQueue(projectID)
}

func (a *App) RemoveFromQueue(id int64) error {
	return a.store.RemoveFromQueue(id)
}

func (a *App) ReorderQueue(projectID int64, ids []int64) error {
	return a.store.ReorderQueue(projectID, ids)
}
