// Package pty manages a pseudo-terminal for running Claude Code.
package pty

import (
	"context"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const DataEvent = "pty:data"
const ExitEvent = "pty:exit"

// Manager owns a single PTY session.
type Manager struct {
	mu   sync.Mutex
	ctx  context.Context
	ptmx *os.File
	cmd  *exec.Cmd
	cols uint16
	rows uint16
}

func New() *Manager {
	return &Manager{cols: 220, rows: 50}
}

// Start spawns the given command in a PTY of the given size.
// Output is streamed to the frontend via Wails events.
func (m *Manager) Start(ctx context.Context, command string, args []string, cols, rows uint16) error {
	return m.StartInDir(ctx, command, args, "", cols, rows)
}

// StartInDir spawns the command in a PTY, optionally setting the working directory.
// extraEnv values are appended to the inherited environment (format: "KEY=VALUE").
func (m *Manager) StartInDir(ctx context.Context, command string, args []string, dir string, cols, rows uint16, extraEnv ...string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.ptmx != nil {
		return nil // already running
	}

	m.ctx = ctx
	m.cols = cols
	m.rows = rows

	cmd := exec.Command(command, args...)
	if dir != "" {
		cmd.Dir = dir
	}
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"TERM_PROGRAM=aiworkbench",
	)
	cmd.Env = append(cmd.Env, extraEnv...)

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
	if err != nil {
		return err
	}

	m.ptmx = ptmx
	m.cmd = cmd

	// Stream output to frontend
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				runtime.EventsEmit(ctx, DataEvent, string(buf[:n]))
			}
			if err != nil {
				if err != io.EOF {
					log.Printf("pty read: %v", err)
				}
				break
			}
		}

		m.mu.Lock()
		m.ptmx = nil
		m.cmd = nil
		m.mu.Unlock()

		runtime.EventsEmit(ctx, ExitEvent, nil)
	}()

	return nil
}

// Stop kills the running process and closes the PTY.
func (m *Manager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.ptmx == nil {
		return
	}
	if m.cmd != nil && m.cmd.Process != nil {
		m.cmd.Process.Kill()
	}
	m.ptmx.Close()
	m.ptmx = nil
	m.cmd = nil
}

// Write sends input to the PTY stdin.
func (m *Manager) Write(data string) error {
	m.mu.Lock()
	ptmx := m.ptmx
	m.mu.Unlock()

	if ptmx == nil {
		return nil
	}
	_, err := ptmx.WriteString(data)
	return err
}

// Resize updates the PTY window size.
func (m *Manager) Resize(cols, rows uint16) error {
	m.mu.Lock()
	ptmx := m.ptmx
	m.cols = cols
	m.rows = rows
	m.mu.Unlock()

	if ptmx == nil {
		return nil
	}
	return pty.Setsize(ptmx, &pty.Winsize{Cols: cols, Rows: rows})
}

// Running reports whether a process is active.
func (m *Manager) Running() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.ptmx != nil
}
