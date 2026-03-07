package store

import "database/sql"

// Store holds the database connection and provides all CRUD operations.
type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}
