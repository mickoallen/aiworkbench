package store

import "fmt"

// ---- Tasks ----

func (s *Store) CreateTask(projectID int64, name, objective, taskType, prompt, model string, canvasX, canvasY float64) (*Task, error) {
	if model == "" {
		model = "claude-sonnet-4-6"
	}
	res, err := s.db.Exec(
		`INSERT INTO tasks (project_id, name, objective, task_type, prompt, model, canvas_x, canvas_y) VALUES (?,?,?,?,?,?,?,?)`,
		projectID, name, objective, taskType, prompt, model, canvasX, canvasY,
	)
	if err != nil {
		return nil, fmt.Errorf("create task: %w", err)
	}
	id, _ := res.LastInsertId()
	return s.GetTask(id)
}

func (s *Store) GetTask(id int64) (*Task, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, name, objective, task_type, prompt, model, status, canvas_x, canvas_y, review_enabled, max_rework, rework_count, created_at, updated_at FROM tasks WHERE id=?`, id,
	)
	t := &Task{}
	if err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Objective, &t.TaskType, &t.Prompt, &t.Model, &t.Status, &t.CanvasX, &t.CanvasY, &t.ReviewEnabled, &t.MaxRework, &t.ReworkCount, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, fmt.Errorf("get task: %w", err)
	}
	return t, nil
}

func (s *Store) ListTasks(projectID int64) ([]Task, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, name, objective, task_type, prompt, model, status, canvas_x, canvas_y, review_enabled, max_rework, rework_count, created_at, updated_at FROM tasks WHERE project_id=? ORDER BY created_at ASC`, projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Objective, &t.TaskType, &t.Prompt, &t.Model, &t.Status, &t.CanvasX, &t.CanvasY, &t.ReviewEnabled, &t.MaxRework, &t.ReworkCount, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (s *Store) UpdateTask(id int64, name, objective, prompt, model, status string) (*Task, error) {
	if model == "" {
		model = "claude-sonnet-4-6"
	}
	_, err := s.db.Exec(
		`UPDATE tasks SET name=?, objective=?, prompt=?, model=?, status=?, updated_at=datetime('now') WHERE id=?`,
		name, objective, prompt, model, status, id,
	)
	if err != nil {
		return nil, fmt.Errorf("update task: %w", err)
	}
	return s.GetTask(id)
}

func (s *Store) UpdateTaskStatus(id int64, status string) error {
	_, err := s.db.Exec(`UPDATE tasks SET status=?, updated_at=datetime('now') WHERE id=?`, status, id)
	return err
}

func (s *Store) UpdateTaskPosition(id int64, x, y float64) error {
	_, err := s.db.Exec(`UPDATE tasks SET canvas_x=?, canvas_y=?, updated_at=datetime('now') WHERE id=?`, x, y, id)
	return err
}

func (s *Store) DeleteTask(id int64) error {
	// Remove queue items for this task and its subtasks first.
	s.db.Exec(`DELETE FROM queue_items WHERE task_id=?`, id)                                                          //nolint
	s.db.Exec(`DELETE FROM queue_items WHERE subtask_id IN (SELECT id FROM subtasks WHERE task_id=?)`, id) //nolint
	_, err := s.db.Exec(`DELETE FROM tasks WHERE id=?`, id)
	return err
}

// ---- Subtasks ----

func (s *Store) CreateSubtask(taskID int64, name, objective, prompt, model string) (*Subtask, error) {
	var pos int
	_ = s.db.QueryRow(`SELECT COALESCE(MAX(position)+1,0) FROM subtasks WHERE task_id=?`, taskID).Scan(&pos)

	if model == "" {
		model = "claude-sonnet-4-6"
	}
	res, err := s.db.Exec(
		`INSERT INTO subtasks (task_id, name, objective, prompt, model, position) VALUES (?,?,?,?,?,?)`,
		taskID, name, objective, prompt, model, pos,
	)
	if err != nil {
		return nil, fmt.Errorf("create subtask: %w", err)
	}
	id, _ := res.LastInsertId()
	return s.GetSubtask(id)
}

func (s *Store) GetSubtask(id int64) (*Subtask, error) {
	row := s.db.QueryRow(
		`SELECT id, task_id, name, objective, prompt, model, status, position, agent, branch_name, pr_number, pr_url, canvas_x, canvas_y, created_at, updated_at FROM subtasks WHERE id=?`, id,
	)
	st := &Subtask{}
	if err := row.Scan(&st.ID, &st.TaskID, &st.Name, &st.Objective, &st.Prompt, &st.Model, &st.Status, &st.Position, &st.Agent, &st.BranchName, &st.PRNumber, &st.PRUrl, &st.CanvasX, &st.CanvasY, &st.CreatedAt, &st.UpdatedAt); err != nil {
		return nil, fmt.Errorf("get subtask: %w", err)
	}
	return st, nil
}

func (s *Store) ListSubtasks(taskID int64) ([]Subtask, error) {
	rows, err := s.db.Query(
		`SELECT id, task_id, name, objective, prompt, model, status, position, agent, branch_name, pr_number, pr_url, canvas_x, canvas_y, created_at, updated_at FROM subtasks WHERE task_id=? ORDER BY position ASC`, taskID,
	)
	if err != nil {
		return nil, fmt.Errorf("list subtasks: %w", err)
	}
	defer rows.Close()

	var subtasks []Subtask
	for rows.Next() {
		var st Subtask
		if err := rows.Scan(&st.ID, &st.TaskID, &st.Name, &st.Objective, &st.Prompt, &st.Model, &st.Status, &st.Position, &st.Agent, &st.BranchName, &st.PRNumber, &st.PRUrl, &st.CanvasX, &st.CanvasY, &st.CreatedAt, &st.UpdatedAt); err != nil {
			return nil, err
		}
		subtasks = append(subtasks, st)
	}
	return subtasks, rows.Err()
}

func (s *Store) UpdateSubtask(id int64, name, objective, prompt, model, status string) (*Subtask, error) {
	if model == "" {
		model = "claude-sonnet-4-6"
	}
	_, err := s.db.Exec(
		`UPDATE subtasks SET name=?, objective=?, prompt=?, model=?, status=?, updated_at=datetime('now') WHERE id=?`,
		name, objective, prompt, model, status, id,
	)
	if err != nil {
		return nil, fmt.Errorf("update subtask: %w", err)
	}
	return s.GetSubtask(id)
}

func (s *Store) UpdateSubtaskStatus(id int64, status string) error {
	_, err := s.db.Exec(`UPDATE subtasks SET status=?, updated_at=datetime('now') WHERE id=?`, status, id)
	return err
}

func (s *Store) DeleteSubtask(id int64) error {
	s.db.Exec(`DELETE FROM queue_items WHERE subtask_id=?`, id) //nolint
	_, err := s.db.Exec(`DELETE FROM subtasks WHERE id=?`, id)
	return err
}

// ---- Dependencies ----

func (s *Store) AddDependency(taskID, dependsOnID int64) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?,?)`,
		taskID, dependsOnID,
	)
	return err
}

func (s *Store) RemoveDependency(taskID, dependsOnID int64) error {
	_, err := s.db.Exec(
		`DELETE FROM task_dependencies WHERE task_id=? AND depends_on_id=?`,
		taskID, dependsOnID,
	)
	return err
}

// ---- Subtask Dependencies ----

func (s *Store) AddSubtaskDependency(subtaskID, dependsOnID int64) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO subtask_dependencies (subtask_id, depends_on_id) VALUES (?,?)`,
		subtaskID, dependsOnID,
	)
	return err
}

func (s *Store) RemoveSubtaskDependency(subtaskID, dependsOnID int64) error {
	_, err := s.db.Exec(
		`DELETE FROM subtask_dependencies WHERE subtask_id=? AND depends_on_id=?`,
		subtaskID, dependsOnID,
	)
	return err
}

func (s *Store) ListSubtaskDependencies(taskID int64) ([]SubtaskDependency, error) {
	rows, err := s.db.Query(
		`SELECT sd.subtask_id, sd.depends_on_id FROM subtask_dependencies sd
		 JOIN subtasks s ON s.id = sd.subtask_id
		 WHERE s.task_id = ?`, taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deps []SubtaskDependency
	for rows.Next() {
		var d SubtaskDependency
		if err := rows.Scan(&d.SubtaskID, &d.DependsOnID); err != nil {
			return nil, err
		}
		deps = append(deps, d)
	}
	return deps, rows.Err()
}

func (s *Store) ListDependencies(projectID int64) ([]TaskDependency, error) {
	rows, err := s.db.Query(
		`SELECT td.task_id, td.depends_on_id FROM task_dependencies td
		 JOIN tasks t ON t.id = td.task_id
		 WHERE t.project_id = ?`, projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deps []TaskDependency
	for rows.Next() {
		var d TaskDependency
		if err := rows.Scan(&d.TaskID, &d.DependsOnID); err != nil {
			return nil, err
		}
		deps = append(deps, d)
	}
	return deps, rows.Err()
}
