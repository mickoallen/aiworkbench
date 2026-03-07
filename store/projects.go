package store

import "fmt"

func (s *Store) CreateProject(name, path, description string) (*Project, error) {
	res, err := s.db.Exec(
		`INSERT INTO projects (name, path, description) VALUES (?, ?, ?)`,
		name, path, description,
	)
	if err != nil {
		return nil, fmt.Errorf("create project: %w", err)
	}
	id, _ := res.LastInsertId()
	return s.GetProject(id)
}

func (s *Store) GetProject(id int64) (*Project, error) {
	row := s.db.QueryRow(`SELECT id, name, path, description, session_branch, created_at, updated_at FROM projects WHERE id = ?`, id)
	p := &Project{}
	if err := row.Scan(&p.ID, &p.Name, &p.Path, &p.Description, &p.SessionBranch, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, fmt.Errorf("get project: %w", err)
	}
	return p, nil
}

func (s *Store) ListProjects() ([]Project, error) {
	rows, err := s.db.Query(`SELECT id, name, path, description, session_branch, created_at, updated_at FROM projects ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list projects: %w", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Path, &p.Description, &p.SessionBranch, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *Store) UpdateProject(id int64, name, description, sessionBranch string) (*Project, error) {
	_, err := s.db.Exec(
		`UPDATE projects SET name=?, description=?, session_branch=?, updated_at=datetime('now') WHERE id=?`,
		name, description, sessionBranch, id,
	)
	if err != nil {
		return nil, fmt.Errorf("update project: %w", err)
	}
	return s.GetProject(id)
}

func (s *Store) DeleteProject(id int64) error {
	_, err := s.db.Exec(`DELETE FROM projects WHERE id=?`, id)
	return err
}
