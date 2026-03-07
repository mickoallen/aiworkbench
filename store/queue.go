package store

import "fmt"

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
		`SELECT id, project_id, task_id, subtask_id, position, status, added_at, started_at, finished_at, error FROM queue_items WHERE id=?`, id,
	)
	q := &QueueItem{}
	if err := row.Scan(&q.ID, &q.ProjectID, &q.TaskID, &q.SubtaskID, &q.Position, &q.Status, &q.AddedAt, &q.StartedAt, &q.FinishedAt, &q.Error); err != nil {
		return nil, err
	}
	return q, nil
}

func (s *Store) ListQueue(projectID int64) ([]QueueItem, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, task_id, subtask_id, position, status, added_at, started_at, finished_at, error FROM queue_items WHERE project_id=? ORDER BY position ASC`, projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list queue: %w", err)
	}
	defer rows.Close()

	var items []QueueItem
	for rows.Next() {
		var q QueueItem
		if err := rows.Scan(&q.ID, &q.ProjectID, &q.TaskID, &q.SubtaskID, &q.Position, &q.Status, &q.AddedAt, &q.StartedAt, &q.FinishedAt, &q.Error); err != nil {
			return nil, err
		}
		items = append(items, q)
	}
	return items, rows.Err()
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
	_, err := s.db.Exec(`DELETE FROM queue_items WHERE id=?`, id)
	return err
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
