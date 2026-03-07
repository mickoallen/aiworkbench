package store

import "fmt"

// ---- Tasks ----

func (s *Store) CreateTask(projectID int64, name, objective, taskType, prompt string, canvasX, canvasY float64) (*Task, error) {
	res, err := s.db.Exec(
		`INSERT INTO tasks (project_id, name, objective, task_type, prompt, canvas_x, canvas_y) VALUES (?,?,?,?,?,?,?)`,
		projectID, name, objective, taskType, prompt, canvasX, canvasY,
	)
	if err != nil {
		return nil, fmt.Errorf("create task: %w", err)
	}
	id, _ := res.LastInsertId()
	return s.GetTask(id)
}

func (s *Store) GetTask(id int64) (*Task, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, name, objective, task_type, prompt, status, canvas_x, canvas_y, review_enabled, max_rework, rework_count, created_at, updated_at FROM tasks WHERE id=?`, id,
	)
	t := &Task{}
	if err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Objective, &t.TaskType, &t.Prompt, &t.Status, &t.CanvasX, &t.CanvasY, &t.ReviewEnabled, &t.MaxRework, &t.ReworkCount, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, fmt.Errorf("get task: %w", err)
	}
	return t, nil
}

func (s *Store) ListTasks(projectID int64) ([]Task, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, name, objective, task_type, prompt, status, canvas_x, canvas_y, review_enabled, max_rework, rework_count, created_at, updated_at FROM tasks WHERE project_id=? ORDER BY created_at ASC`, projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Objective, &t.TaskType, &t.Prompt, &t.Status, &t.CanvasX, &t.CanvasY, &t.ReviewEnabled, &t.MaxRework, &t.ReworkCount, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (s *Store) UpdateTask(id int64, name, objective, prompt, status string) (*Task, error) {
	_, err := s.db.Exec(
		`UPDATE tasks SET name=?, objective=?, prompt=?, status=?, updated_at=datetime('now') WHERE id=?`,
		name, objective, prompt, status, id,
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
	_, err := s.db.Exec(`DELETE FROM tasks WHERE id=?`, id)
	return err
}

// ---- Subtasks ----

func (s *Store) CreateSubtask(taskID int64, name, objective, prompt string) (*Subtask, error) {
	var pos int
	_ = s.db.QueryRow(`SELECT COALESCE(MAX(position)+1,0) FROM subtasks WHERE task_id=?`, taskID).Scan(&pos)

	res, err := s.db.Exec(
		`INSERT INTO subtasks (task_id, name, objective, prompt, position) VALUES (?,?,?,?,?)`,
		taskID, name, objective, prompt, pos,
	)
	if err != nil {
		return nil, fmt.Errorf("create subtask: %w", err)
	}
	id, _ := res.LastInsertId()
	return s.GetSubtask(id)
}

func (s *Store) GetSubtask(id int64) (*Subtask, error) {
	row := s.db.QueryRow(
		`SELECT id, task_id, name, objective, prompt, status, position, agent, branch_name, pr_number, pr_url, canvas_x, canvas_y, created_at, updated_at FROM subtasks WHERE id=?`, id,
	)
	st := &Subtask{}
	if err := row.Scan(&st.ID, &st.TaskID, &st.Name, &st.Objective, &st.Prompt, &st.Status, &st.Position, &st.Agent, &st.BranchName, &st.PRNumber, &st.PRUrl, &st.CanvasX, &st.CanvasY, &st.CreatedAt, &st.UpdatedAt); err != nil {
		return nil, fmt.Errorf("get subtask: %w", err)
	}
	return st, nil
}

func (s *Store) ListSubtasks(taskID int64) ([]Subtask, error) {
	rows, err := s.db.Query(
		`SELECT id, task_id, name, objective, prompt, status, position, agent, branch_name, pr_number, pr_url, canvas_x, canvas_y, created_at, updated_at FROM subtasks WHERE task_id=? ORDER BY position ASC`, taskID,
	)
	if err != nil {
		return nil, fmt.Errorf("list subtasks: %w", err)
	}
	defer rows.Close()

	var subtasks []Subtask
	for rows.Next() {
		var st Subtask
		if err := rows.Scan(&st.ID, &st.TaskID, &st.Name, &st.Objective, &st.Prompt, &st.Status, &st.Position, &st.Agent, &st.BranchName, &st.PRNumber, &st.PRUrl, &st.CanvasX, &st.CanvasY, &st.CreatedAt, &st.UpdatedAt); err != nil {
			return nil, err
		}
		subtasks = append(subtasks, st)
	}
	return subtasks, rows.Err()
}

func (s *Store) UpdateSubtask(id int64, name, objective, prompt, status string) (*Subtask, error) {
	_, err := s.db.Exec(
		`UPDATE subtasks SET name=?, objective=?, prompt=?, status=?, updated_at=datetime('now') WHERE id=?`,
		name, objective, prompt, status, id,
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
