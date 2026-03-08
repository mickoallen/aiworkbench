package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var migrations = []string{
	// [0] bootstrap — always runs
	`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`,

	// [1] initial schema
	`CREATE TABLE projects (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		name          TEXT    NOT NULL,
		path          TEXT    NOT NULL,
		description   TEXT    NOT NULL DEFAULT '',
		session_branch TEXT   NOT NULL DEFAULT '',
		created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
		updated_at    DATETIME NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE tasks (
		id             INTEGER PRIMARY KEY AUTOINCREMENT,
		project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
		name           TEXT    NOT NULL,
		objective      TEXT    NOT NULL DEFAULT '',
		task_type      TEXT    NOT NULL DEFAULT 'leaf' CHECK(task_type IN ('leaf','container')),
		prompt         TEXT    NOT NULL DEFAULT '',
		status         TEXT    NOT NULL DEFAULT 'planning' CHECK(status IN ('planning','ready','queued','running','done','failed')),
		canvas_x       REAL    NOT NULL DEFAULT 0,
		canvas_y       REAL    NOT NULL DEFAULT 0,
		review_enabled INTEGER NOT NULL DEFAULT 0,
		max_rework     INTEGER NOT NULL DEFAULT 3,
		rework_count   INTEGER NOT NULL DEFAULT 0,
		created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
		updated_at     DATETIME NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE subtasks (
		id           INTEGER PRIMARY KEY AUTOINCREMENT,
		task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
		name         TEXT    NOT NULL,
		objective    TEXT    NOT NULL DEFAULT '',
		prompt       TEXT    NOT NULL DEFAULT '',
		status       TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','queued','running','done','failed')),
		position     INTEGER NOT NULL DEFAULT 0,
		agent        TEXT    NOT NULL DEFAULT 'claude',
		branch_name  TEXT    NOT NULL DEFAULT '',
		pr_number    INTEGER,
		pr_url       TEXT    NOT NULL DEFAULT '',
		canvas_x     REAL    NOT NULL DEFAULT 0,
		canvas_y     REAL    NOT NULL DEFAULT 0,
		created_at   DATETIME NOT NULL DEFAULT (datetime('now')),
		updated_at   DATETIME NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE task_dependencies (
		task_id       INTEGER NOT NULL,
		depends_on_id INTEGER NOT NULL,
		PRIMARY KEY (task_id, depends_on_id)
	);

	CREATE TABLE queue_items (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
		task_id     INTEGER,
		subtask_id  INTEGER,
		position    INTEGER NOT NULL DEFAULT 0,
		status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','failed','cancelled')),
		added_at    DATETIME NOT NULL DEFAULT (datetime('now')),
		started_at  DATETIME,
		finished_at DATETIME,
		error       TEXT    NOT NULL DEFAULT ''
	);

	CREATE TABLE subtask_executions (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		subtask_id  INTEGER NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
		agent       TEXT    NOT NULL DEFAULT 'claude',
		status      TEXT    NOT NULL DEFAULT 'running',
		prompt      TEXT    NOT NULL DEFAULT '',
		output      TEXT    NOT NULL DEFAULT '',
		exit_code   INTEGER,
		started_at  DATETIME NOT NULL DEFAULT (datetime('now')),
		finished_at DATETIME
	);

	CREATE TABLE chat_messages (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
		role       TEXT    NOT NULL CHECK(role IN ('user','assistant','system')),
		content    TEXT    NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT (datetime('now'))
	);`,

	// [2] subtask dependencies
	`CREATE TABLE subtask_dependencies (
		subtask_id    INTEGER NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
		depends_on_id INTEGER NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
		PRIMARY KEY (subtask_id, depends_on_id)
	)`,

	// [3] output column on queue_items for storing claude output
	`ALTER TABLE queue_items ADD COLUMN output TEXT NOT NULL DEFAULT ''`,

	// [4] model column on subtasks for specifying desired Claude model
	`ALTER TABLE subtasks ADD COLUMN model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'`,

	// [5] agent and model columns on tasks
	`ALTER TABLE tasks ADD COLUMN agent TEXT NOT NULL DEFAULT 'claude';
	 ALTER TABLE tasks ADD COLUMN model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'`,
}

func Open() (*sql.DB, error) {
	dir, err := appDataDir()
	if err != nil {
		return nil, fmt.Errorf("data dir: %w", err)
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("mkdir: %w", err)
	}

	path := filepath.Join(dir, "aiworkbench.db")
	db, err := sql.Open("sqlite", path+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("open: %w", err)
	}

	if err := migrate(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	// Bootstrap the version table
	if _, err := db.Exec(migrations[0]); err != nil {
		return err
	}

	var current int
	_ = db.QueryRow(`SELECT COALESCE(MAX(version), 0) FROM schema_version`).Scan(&current)

	for i, sql := range migrations[1:] {
		version := i + 1
		if version <= current {
			continue
		}
		if _, err := db.Exec(sql); err != nil {
			return fmt.Errorf("migration %d: %w", version, err)
		}
		if _, err := db.Exec(`INSERT INTO schema_version (version) VALUES (?)`, version); err != nil {
			return fmt.Errorf("record migration %d: %w", version, err)
		}
	}
	return nil
}

func appDataDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library", "Application Support", "aiworkbench"), nil
}
