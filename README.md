# aiworkbench

A native macOS desktop app for orchestrating Claude Code agents across a visual task canvas.

## What it does

aiworkbench lets you plan, queue, and run Claude Code tasks from a drag-and-drop canvas. You define tasks (or grouped containers of subtasks), draw dependency edges between them, and queue them up for automated execution. A built-in runner processes the queue in order, spinning up Claude Code in each project's directory via a PTY session.

Tasks and their dependencies are persisted in a local SQLite database. An embedded MCP server exposes the task board to running Claude agents so they can read context and update their own status.

## Concepts

- **Leaf task** — a single unit of work with a prompt, run by one Claude Code session
- **Container task** — a group of ordered subtasks, each run sequentially by Claude Code
- **Dependencies** — draw edges on the canvas to enforce ordering; queuing a task auto-queues its deps first, removing a task cascades to remove dependents
- **Queue** — ordered list of pending/running/done items; a runner per project processes them one at a time
- **MCP server** — HTTP JSON-RPC server started at launch; Claude agents connect via `.mcp.json` written to each project directory

## Requirements

- macOS
- [Wails v2](https://wails.io) (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- Go 1.21+
- Node 18+
- [Claude Code](https://github.com/anthropics/claude-code) installed and on `$PATH`

## Development

```bash
wails dev
```

Hot-reloads the frontend. Go changes require a restart.

## Build

```bash
wails build
```

Produces a `.app` bundle in `build/bin/`.

## Data

The SQLite database lives at `~/Library/Application Support/aiworkbench/aiworkbench.db`. Schema migrations run automatically on startup.
