package store

import "fmt"

// AddTaskToQueueWithDeps queues a task (leaf or container) and all transitive task-level deps.
// Container deps are expanded to their subtasks; leaf deps are queued directly.
func (s *Store) AddTaskToQueueWithDeps(projectID, taskID int64) error {
	return s.enqueueTaskTree(projectID, taskID, map[int64]bool{}, map[int64]bool{})
}

// enqueueTaskTree is the unified recursive worker for both leaf and container tasks.
func (s *Store) enqueueTaskTree(projectID, taskID int64, visitedTasks, visitedSubtasks map[int64]bool) error {
	if visitedTasks[taskID] {
		return nil
	}
	visitedTasks[taskID] = true

	// Walk task-level deps first (recurse).
	rows, err := s.db.Query(`SELECT depends_on_id FROM task_dependencies WHERE task_id=?`, taskID)
	if err != nil {
		return err
	}
	var deps []int64
	for rows.Next() {
		var id int64
		rows.Scan(&id) //nolint
		deps = append(deps, id)
	}
	rows.Close()

	for _, depID := range deps {
		if err := s.enqueueTaskTree(projectID, depID, visitedTasks, visitedSubtasks); err != nil {
			return err
		}
	}

	// Now enqueue this task: containers → their subtasks, leaves → direct queue entry.
	task, err := s.GetTask(taskID)
	if err != nil {
		return err
	}

	if task.TaskType == "container" {
		subtasks, err := s.ListSubtasks(taskID)
		if err != nil {
			return err
		}
		for _, st := range subtasks {
			if err := s.enqueueSubtask(projectID, st.ID, visitedSubtasks); err != nil {
				return err
			}
		}
	} else {
		var count int
		s.db.QueryRow(`SELECT COUNT(*) FROM queue_items WHERE project_id=? AND task_id=? AND status IN ('pending','running','done')`, projectID, taskID).Scan(&count) //nolint
		if count == 0 {
			if _, err = s.AddToQueue(projectID, &taskID, nil); err == nil {
				_ = s.UpdateTaskStatus(taskID, "queued")
			}
		}
	}
	return err
}

// AddSubtaskToQueueWithDeps queues a subtask and all its transitive deps (deps first).
func (s *Store) AddSubtaskToQueueWithDeps(projectID, subtaskID int64) error {
	visited := map[int64]bool{}
	return s.enqueueSubtask(projectID, subtaskID, visited)
}

func (s *Store) enqueueSubtask(projectID, subtaskID int64, visited map[int64]bool) error {
	if visited[subtaskID] {
		return nil
	}
	visited[subtaskID] = true

	rows, err := s.db.Query(`SELECT depends_on_id FROM subtask_dependencies WHERE subtask_id=?`, subtaskID)
	if err != nil {
		return err
	}
	var deps []int64
	for rows.Next() {
		var id int64
		rows.Scan(&id) //nolint
		deps = append(deps, id)
	}
	rows.Close()

	for _, depID := range deps {
		if err := s.enqueueSubtask(projectID, depID, visited); err != nil {
			return err
		}
	}

	var count int
	s.db.QueryRow(`SELECT COUNT(*) FROM queue_items WHERE project_id=? AND subtask_id=? AND status IN ('pending','running','done')`, projectID, subtaskID).Scan(&count) //nolint
	if count == 0 {
		_, err = s.AddToQueue(projectID, nil, &subtaskID)
		if err == nil {
			_ = s.UpdateSubtaskStatus(subtaskID, "queued")
		}
	}
	return err
}

// QueueContainerSubtasks queues a container's subtasks respecting task-level deps.
func (s *Store) QueueContainerSubtasks(projectID, taskID int64) error {
	return s.enqueueTaskTree(projectID, taskID, map[int64]bool{}, map[int64]bool{})
}

// RemoveFromQueueCascade removes a queue item and any pending items whose dependencies are no longer satisfied.
func (s *Store) RemoveFromQueueCascade(queueID int64) error {
	item, err := s.getQueueItem(queueID)
	if err != nil {
		return nil // already gone
	}
	if _, err := s.db.Exec(`DELETE FROM queue_items WHERE id=?`, queueID); err != nil {
		return err
	}
	s.revertItemStatus(item)
	s.purgeDependentQueueItems(item.ProjectID)
	return nil
}

// purgeDependentQueueItems removes pending queue items that have dependencies no longer
// in queue or done. Iterates until stable to handle transitive chains.
func (s *Store) purgeDependentQueueItems(projectID int64) {
	for {
		n := s.purgeTaskItems(projectID) + s.purgeSubtaskItems(projectID)
		if n == 0 {
			break
		}
	}
}

// purgeTaskItems removes pending leaf-task queue items whose task dep is not done/queued/running.
func (s *Store) purgeTaskItems(projectID int64) int {
	rows, err := s.db.Query(`
		SELECT DISTINCT qi.id, qi.task_id
		FROM queue_items qi
		JOIN task_dependencies td ON td.task_id = qi.task_id
		JOIN tasks dep ON dep.id = td.depends_on_id
		WHERE qi.project_id = ? AND qi.status = 'pending' AND qi.task_id IS NOT NULL
		  AND dep.status NOT IN ('done','queued','running')
	`, projectID)
	if err != nil {
		return 0
	}
	type row struct{ id, taskID int64 }
	var items []row
	for rows.Next() {
		var r row
		rows.Scan(&r.id, &r.taskID) //nolint
		items = append(items, r)
	}
	rows.Close()
	for _, r := range items {
		s.db.Exec(`DELETE FROM queue_items WHERE id=?`, r.id)                                          //nolint
		s.db.Exec(`UPDATE tasks SET status='ready', updated_at=datetime('now') WHERE id=?`, r.taskID) //nolint
	}
	return len(items)
}

// purgeSubtaskItems removes pending subtask queue items whose subtask dep (or parent container's
// task dep) is not done/queued/running.
func (s *Store) purgeSubtaskItems(projectID int64) int {
	seen := map[int64]bool{}
	ids := []int64{}
	subtaskIDs := []int64{}

	addRows := func(query string) {
		rows, err := s.db.Query(query, projectID)
		if err != nil {
			return
		}
		defer rows.Close()
		for rows.Next() {
			var id, subtaskID int64
			rows.Scan(&id, &subtaskID) //nolint
			if !seen[id] {
				seen[id] = true
				ids = append(ids, id)
				subtaskIDs = append(subtaskIDs, subtaskID)
			}
		}
	}

	// Subtask-level deps
	addRows(`
		SELECT DISTINCT qi.id, qi.subtask_id
		FROM queue_items qi
		JOIN subtask_dependencies sd ON sd.subtask_id = qi.subtask_id
		JOIN subtasks dep ON dep.id = sd.depends_on_id
		WHERE qi.project_id = ? AND qi.status = 'pending' AND qi.subtask_id IS NOT NULL
		  AND dep.status NOT IN ('done','queued','running')
	`)

	// Task-level deps for container subtasks
	addRows(`
		SELECT DISTINCT qi.id, qi.subtask_id
		FROM queue_items qi
		JOIN subtasks st ON st.id = qi.subtask_id
		JOIN task_dependencies td ON td.task_id = st.task_id
		JOIN tasks dep ON dep.id = td.depends_on_id
		WHERE qi.project_id = ? AND qi.status = 'pending' AND qi.subtask_id IS NOT NULL
		  AND dep.status NOT IN ('done','queued','running')
	`)

	for i, id := range ids {
		s.db.Exec(`DELETE FROM queue_items WHERE id=?`, id)                                                      //nolint
		s.db.Exec(`UPDATE subtasks SET status='ready', updated_at=datetime('now') WHERE id=?`, subtaskIDs[i]) //nolint
	}
	return len(ids)
}

// DequeueTask removes a task's pending queue entry (cascade) and reverts its status.
func (s *Store) DequeueTask(projectID, taskID int64) error {
	var queueID int64
	if err := s.db.QueryRow(`SELECT id FROM queue_items WHERE project_id=? AND task_id=? AND status='pending'`, projectID, taskID).Scan(&queueID); err != nil {
		return nil // not in queue
	}
	return s.RemoveFromQueueCascade(queueID)
}

// DequeueSubtask removes a subtask's pending queue entry (cascade) and reverts its status.
func (s *Store) DequeueSubtask(projectID, subtaskID int64) error {
	var queueID int64
	if err := s.db.QueryRow(`SELECT id FROM queue_items WHERE project_id=? AND subtask_id=? AND status='pending'`, projectID, subtaskID).Scan(&queueID); err != nil {
		return nil // not in queue
	}
	return s.RemoveFromQueueCascade(queueID)
}

// DequeueContainerSubtasks removes all pending subtasks of a container from the queue.
func (s *Store) DequeueContainerSubtasks(projectID, taskID int64) error {
	subtasks, _ := s.ListSubtasks(taskID)
	for _, st := range subtasks {
		if st.Status == "queued" {
			_ = s.DequeueSubtask(projectID, st.ID)
		}
	}
	return nil
}

// revertItemStatus sets a task or subtask back to "ready" when removed from the queue.
func (s *Store) revertItemStatus(item *QueueItem) {
	if item.TaskID != nil {
		_ = s.UpdateTaskStatus(*item.TaskID, "ready")
	} else if item.SubtaskID != nil {
		_ = s.UpdateSubtaskStatus(*item.SubtaskID, "ready")
	}
}

// CheckTaskDepsComplete returns a message if any dep is not done, or "" if all clear.
func (s *Store) CheckTaskDepsComplete(taskID int64) (string, error) {
	row := s.db.QueryRow(`
		SELECT t.name, t.status FROM task_dependencies td
		JOIN tasks t ON t.id = td.depends_on_id
		WHERE td.task_id=? AND t.status != 'done'
		LIMIT 1
	`, taskID)
	var name, status string
	if err := row.Scan(&name, &status); err != nil {
		return "", nil
	}
	return fmt.Sprintf("dependency not complete: %s [%s]", name, status), nil
}

// CheckSubtaskDepsComplete returns a message if any dep is not done, or "" if all clear.
func (s *Store) CheckSubtaskDepsComplete(subtaskID int64) (string, error) {
	row := s.db.QueryRow(`
		SELECT st.name, st.status FROM subtask_dependencies sd
		JOIN subtasks st ON st.id = sd.depends_on_id
		WHERE sd.subtask_id=? AND st.status != 'done'
		LIMIT 1
	`, subtaskID)
	var name, status string
	if err := row.Scan(&name, &status); err != nil {
		return "", nil
	}
	return fmt.Sprintf("dependency not complete: %s [%s]", name, status), nil
}

func (s *Store) AddToQueue(projectID int64, taskID *int64, subtaskID *int64) (*QueueItem, error) {
	var pos int
	_ = s.db.QueryRow(`SELECT COALESCE(MAX(position)+1,0) FROM queue_items WHERE project_id=?`, projectID).Scan(&pos)

	res, err := s.db.Exec(
		`INSERT INTO queue_items (project_id, task_id, subtask_id, position) VALUES (?,?,?,?)`,
		projectID, taskID, subtaskID, pos,
	)
	if err != nil {
		return nil, fmt.Errorf("add to queue: %w", err)
	}
	id, _ := res.LastInsertId()
	return s.getQueueItem(id)
}

func (s *Store) getQueueItem(id int64) (*QueueItem, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, task_id, subtask_id, position, status, added_at, started_at, finished_at, error, output FROM queue_items WHERE id=?`, id,
	)
	q := &QueueItem{}
	if err := row.Scan(&q.ID, &q.ProjectID, &q.TaskID, &q.SubtaskID, &q.Position, &q.Status, &q.AddedAt, &q.StartedAt, &q.FinishedAt, &q.Error, &q.Output); err != nil {
		return nil, err
	}
	return q, nil
}

func (s *Store) ListQueue(projectID int64) ([]QueueItem, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, task_id, subtask_id, position, status, added_at, started_at, finished_at, error, output FROM queue_items WHERE project_id=? ORDER BY position ASC`, projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list queue: %w", err)
	}
	defer rows.Close()

	var items []QueueItem
	for rows.Next() {
		var q QueueItem
		if err := rows.Scan(&q.ID, &q.ProjectID, &q.TaskID, &q.SubtaskID, &q.Position, &q.Status, &q.AddedAt, &q.StartedAt, &q.FinishedAt, &q.Error, &q.Output); err != nil {
			return nil, err
		}
		items = append(items, q)
	}
	return items, rows.Err()
}

// NextPendingQueueItem returns the first pending item for the given project, or nil if none.
func (s *Store) NextPendingQueueItem(projectID int64) (*QueueItem, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, task_id, subtask_id, position, status, added_at, started_at, finished_at, error, output FROM queue_items WHERE project_id=? AND status='pending' ORDER BY position ASC LIMIT 1`, projectID,
	)
	q := &QueueItem{}
	if err := row.Scan(&q.ID, &q.ProjectID, &q.TaskID, &q.SubtaskID, &q.Position, &q.Status, &q.AddedAt, &q.StartedAt, &q.FinishedAt, &q.Error, &q.Output); err != nil {
		return nil, nil // no pending item
	}
	return q, nil
}

// FinishQueueItem marks a queue item terminal with output and optional error message.
func (s *Store) FinishQueueItem(id int64, status, output, errMsg string) error {
	_, err := s.db.Exec(
		`UPDATE queue_items SET status=?, output=?, error=?, finished_at=datetime('now') WHERE id=?`,
		status, output, errMsg, id,
	)
	return err
}

func (s *Store) UpdateQueueItemStatus(id int64, status string) error {
	switch status {
	case "running":
		_, err := s.db.Exec(`UPDATE queue_items SET status=?, started_at=datetime('now') WHERE id=?`, status, id)
		return err
	case "done", "failed", "cancelled":
		_, err := s.db.Exec(`UPDATE queue_items SET status=?, finished_at=datetime('now') WHERE id=?`, status, id)
		return err
	default:
		_, err := s.db.Exec(`UPDATE queue_items SET status=? WHERE id=?`, status, id)
		return err
	}
}

func (s *Store) RemoveFromQueue(id int64) error {
	item, _ := s.getQueueItem(id)
	if _, err := s.db.Exec(`DELETE FROM queue_items WHERE id=?`, id); err != nil {
		return err
	}
	if item != nil {
		s.revertItemStatus(item)
	}
	return nil
}

func (s *Store) ReorderQueue(projectID int64, ids []int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for i, id := range ids {
		if _, err := tx.Exec(`UPDATE queue_items SET position=? WHERE id=? AND project_id=?`, i, id, projectID); err != nil {
			return err
		}
	}
	return tx.Commit()
}
