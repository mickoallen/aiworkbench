# aiworkbench — Build Plan

## What We're Building

A native macOS desktop app for breaking software work into tasks, dispatching them to Claude Code, and watching them execute on a 2D canvas. The canvas is the centrepiece — you see tasks, dependencies, and live execution status at a glance. Claude Code runs in a prominent terminal pane that actually works.

**Stack:** Wails v2 (Go backend + React frontend in a native macOS window), SQLite, React Flow, xterm.js.

---

## Core Concepts

### Tasks and Subtasks

A **Task** is one of two things (exclusive):

- **Container task** — has a name and objective, contains an ordered list of subtasks. The scheduler walks the subtask DAG.
- **Leaf task** — has a name, objective, and prompt (the instructions sent to Claude Code). Can be queued and executed directly.

A **Subtask** is always a leaf — name, objective, prompt. Subtasks live inside a container task.

Both tasks and subtasks support explicit dependency edges. The scheduler respects the dependency graph: a task/subtask won't start until all its predecessors are done.

### Claude Code Only

No multi-agent complexity. Everything dispatches to Claude Code via its CLI with an MCP config injected. No agent selector anywhere in the UI.

### MCP Server

The app runs a built-in MCP server (streamable HTTP). Claude Code connects to it automatically when dispatched. The server gives Claude tools to read/write the task board and access the project filesystem. This is how the canvas updates in real time as Claude works.

### Terminal First

Claude Code's interactive TUI (file browser, tool picker, progress display) needs a proper terminal. The terminal pane is always visible, full width, and correctly sized. A fullscreen toggle is available for when Claude's TUI needs the whole screen.

---

## Data Model

### Project
```
id, name, path, description, session_branch, created_at, updated_at
```

### Task
```
id, project_id, name, objective, task_type (leaf|container)
prompt          -- leaf only
status          -- planning | ready | queued | running | done | failed
canvas_x, canvas_y
review_enabled, max_rework, rework_count   -- reserved, not surfaced in UI yet
created_at, updated_at
```

### Subtask
```
id, task_id (FK to container task), name, objective, prompt
status          -- pending | ready | queued | running | done | failed
position        -- ordering within the container
agent           -- always "claude" for now
branch_name, pr_number, pr_url
canvas_x, canvas_y
created_at, updated_at
```

### TaskDependency
```
task_id, depends_on_id    -- works for task→task and subtask→subtask
```

### QueueItem
```
id, project_id, task_id (or subtask_id), position, status, added_at, started_at, finished_at, error
```

### SubtaskExecution
```
id, subtask_id, agent, status, prompt, output, exit_code, started_at, finished_at
```

### ChatMessage (for coordinator sessions)
```
id, project_id, role, content, created_at
```

---

## UI Layout

```
┌─ aiworkbench ── /path/to/project ── branch: main ────────┐
├──────────────────────────────────────────┬────────────────┤
│                                          │                │
│             2D CANVAS (React Flow)       │  QUEUE         │
│                                          │  (right drawer │
│  ┌─[ Task: Add Auth ]─────────────────┐  │   toggle)      │
│  │  container · 3 subtasks · planning │  │                │
│  │                                    │  │  1. subtask a  │
│  │  ┌─[ define schema ]─┐             │  │  2. subtask b  │
│  │  │ [pending]         │──▶ ...      │  │  3. subtask c  │
│  │  └───────────────────┘             │  │                │
│  └────────────────────────────────────┘  │  [▶ start]     │
│                                          │  [■ stop]      │
│  ┌─[ Leaf task: Write tests ]─────────┐  │                │
│  │ [ready]  objective: ...            │  └────────────────┤
│  └────────────────────────────────────┘                   │
├───────────────────────────────────────────────────────────┤
│ CLAUDE  ● running  220×48  [□ fullscreen]  [■ stop]       │
│                                                           │
│  ...Claude Code terminal, full width, always visible...   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Top bar:** project name, path, branch button, settings
**Canvas:** React Flow, 2D DAG, fills top portion
**Queue drawer:** right side, toggled, shows queue and run controls
**Terminal pane:** always visible, full width, resizable drag handle, fullscreen toggle

---

## Canvas Aesthetics

- Monospace font (JetBrains Mono) everywhere
- Dark flat background, one accent colour (TBD), no gradients or glow effects
- Container task nodes: a box that visually wraps its subtask cards, dashed border
- Leaf task / subtask cards: compact, `[status]` text badge, name, no agent selector
- Dependency edges: clean arrows
- Status as text badges: `[pending]` `[running]` `[done]` `[failed]` — no coloured dots

---

## Terminal Requirements

Claude Code renders its own rich TUI. The terminal must handle this correctly.

**Known failure mode:** PTY reports wrong dimensions → Claude Code miscalculates line widths → garbled output, wrapped lines, repeating text.

**Requirements:**
- Attach `ResizeObserver` to the exact DOM node xterm renders into
- On resize: debounce 16ms, call `fitAddon.fit()`, then immediately sync `TIOCSWINSZ` to PTY
- On spawn: set `TERM=xterm-256color`, `COLORTERM=truecolor`, `LINES`, `COLUMNS` in PTY env
- Terminal pane is full width with no flex siblings on the same row
- Fullscreen toggle expands terminal to fill entire window
- xterm: `allowProposedApi: true`, `macOptionIsMeta: true`, full mouse passthrough

---

## Build Phases

### Phase 1 — Scaffold ✓ DONE
- Wails v2 project init (Go + React/TypeScript) ✓
- Tailwind CSS v4 (via `@tailwindcss/vite`, Vite upgraded v3→v7) ✓
- SQLite (modernc.org/sqlite, pure Go, no CGO) with versioned migration system ✓
- App struct wires DB on startup ✓
- Window 1440×900, dark background #0d1117 ✓

**Deliverable:** Empty native app window opens. ✓

---

### Phase 2 — Data layer ✓ DONE
- SQLite schema migration: projects, tasks, subtasks, task_dependencies, queue_items, subtask_executions, chat_messages ✓
- Go CRUD for every entity (store/ package) ✓
- Wails bindings on App: Project, Task, Subtask, Dependency, Queue operations ✓
- MCP server (mcp/server.go): HTTP JSON-RPC, initialize handshake, tools/list, tools/call ✓
- Tool stubs wired to store: list_tasks, create_task, update_task_status, create_subtask, set_dependency ✓
- MCP server starts on random port at startup, addr exposed via MCPAddr() binding ✓

**Deliverable:** All data operations work via Go bindings. MCP server accepts connections. ✓

---

### Phase 3 — Canvas ✓ DONE
- React Flow (@xyflow/react) canvas in main content area ✓
- `LeafTaskNode` — compact card with [status] badge, name, objective ✓
- `ContainerTaskNode` — dashed border, inline subtask cards with [status] badges ✓
- Dependency edges — draw by dragging handles, double-click to delete ✓
- Dagre auto-layout on first load (all positions zero), persists on drag ✓
- Drag to rearrange, zoom, pan ✓
- Position changes persist via UpdateTaskPosition binding ✓
- Project picker — create project (dir dialog + name), or select from recents ✓
- Top bar with project name, path, branch, switch button ✓
- `OpenDirDialog` Go binding added ✓

**Deliverable:** Tasks and subtasks visible on canvas. Dependencies drawable. Layout persists. ✓

---

### Phase 4 — Task interactions ✓ DONE
- Click leaf task node → `TaskModal`: edit name, objective, prompt, status; delete ✓
- Click container task node → `ContainerModal`: edit name, objective; delete; manage subtasks ✓
- Add subtask button inside ContainerModal with inline form ✓
- Edit/delete individual subtasks inline in ContainerModal ✓
- "+ new task" floating button → `NewTaskModal`: type selector (leaf/container), name, objective, prompt ✓
- Drag handles to create dependency edges (Phase 3) ✓
- Double-click edge to delete (Phase 3) ✓
- Canvas reloads after every mutation ✓

**Deliverable:** Full task/subtask CRUD via canvas interactions. ✓

---

### Phase 5 — Terminal ✓ DONE
- xterm.js (@xterm/xterm v5) pane, always visible, full width, bottom of layout ✓
- PTY spawning via Go (creack/pty), TERM=dumb (plain text mode — xterm-256color caused TUI misalignment due to Unicode ambiguous-width chars in WebKit) ✓
- ResizeObserver → 16ms debounce → fitAddon.fit() → PTYResize (TIOCSWINSZ) ✓
- PTY output streamed via Wails event `pty:data` → xterm.write() ✓
- PTY exit event `pty:exit` → "[process exited]" message ✓
- Drag handle to resize pane height (min 120px) ✓
- Fullscreen toggle (position: fixed, inset: 0) ✓
- ▶ start / ■ stop buttons, idle/running status, cols×rows display ✓

**Deliverable:** Claude Code runs in the terminal. Its TUI renders without garbling. ✓

---

### Phase 6 — Queue and execution
- Queue panel (right drawer): add tasks/subtasks to queue, reorder, start/stop
- Scheduler: walks dependency graph, dispatches next ready item
- Dispatch: spawn Claude Code CLI with task prompt + MCP config
- MCP tools for execution: update status, report progress
- Task/subtask cards update in real time as Claude works (via Wails events)
- Git integration: branch per task, PR per subtask (optional, can be disabled)

**Deliverable:** Queue tasks, start the queue, watch Claude execute them on the canvas.

---

### Phase 7 — MCP tools for Claude (coordinator mode)
- Full MCP tool set: create_task, create_subtask, set_dependency, update_task, list_tasks, read_file, list_directory, search_files
- Coordinator session: start Claude with a project-aware system prompt + MCP connection
- Claude can read the codebase and build/modify the task board in real time
- Canvas updates live as Claude makes MCP tool calls

**Deliverable:** Chat with Claude to plan work. Watch the canvas update.

---

### Phase 8 — Polish
- Splash screen / project picker
- Settings panel (git config, verification toggles)
- Branch/PR modal
- Keyboard shortcuts (focus terminal, toggle queue drawer, new task)
- Error handling and toasts
- App icon, window title

---

## Future (not in scope now)
- Rework loops (review → retry with feedback, configurable max retries)
- Parallel execution for independent tasks
- Goose / Amp agent support
- Embedded diff viewer
- Notification system
