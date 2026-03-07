package store

import "time"

type Project struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	Path          string    `json:"path"`
	Description   string    `json:"description"`
	SessionBranch string    `json:"session_branch"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Task struct {
	ID            int64     `json:"id"`
	ProjectID     int64     `json:"project_id"`
	Name          string    `json:"name"`
	Objective     string    `json:"objective"`
	TaskType      string    `json:"task_type"` // "leaf" | "container"
	Prompt        string    `json:"prompt"`
	Status        string    `json:"status"`
	CanvasX       float64   `json:"canvas_x"`
	CanvasY       float64   `json:"canvas_y"`
	ReviewEnabled bool      `json:"review_enabled"`
	MaxRework     int       `json:"max_rework"`
	ReworkCount   int       `json:"rework_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Subtask struct {
	ID         int64     `json:"id"`
	TaskID     int64     `json:"task_id"`
	Name       string    `json:"name"`
	Objective  string    `json:"objective"`
	Prompt     string    `json:"prompt"`
	Status     string    `json:"status"`
	Position   int       `json:"position"`
	Agent      string    `json:"agent"`
	BranchName string    `json:"branch_name"`
	PRNumber   *int64    `json:"pr_number"`
	PRUrl      string    `json:"pr_url"`
	CanvasX    float64   `json:"canvas_x"`
	CanvasY    float64   `json:"canvas_y"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type TaskDependency struct {
	TaskID      int64 `json:"task_id"`
	DependsOnID int64 `json:"depends_on_id"`
}

type QueueItem struct {
	ID         int64      `json:"id"`
	ProjectID  int64      `json:"project_id"`
	TaskID     *int64     `json:"task_id"`
	SubtaskID  *int64     `json:"subtask_id"`
	Position   int        `json:"position"`
	Status     string     `json:"status"`
	AddedAt    time.Time  `json:"added_at"`
	StartedAt  *time.Time `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
	Error      string     `json:"error"`
}

type SubtaskExecution struct {
	ID         int64      `json:"id"`
	SubtaskID  int64      `json:"subtask_id"`
	Agent      string     `json:"agent"`
	Status     string     `json:"status"`
	Prompt     string     `json:"prompt"`
	Output     string     `json:"output"`
	ExitCode   *int       `json:"exit_code"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
}

type ChatMessage struct {
	ID        int64     `json:"id"`
	ProjectID int64     `json:"project_id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}
