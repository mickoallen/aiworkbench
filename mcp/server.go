// Package mcp implements a minimal MCP (Model Context Protocol) server
// using streamable HTTP transport. Claude Code connects to this server
// to read/write the task board and access the project filesystem.
package mcp

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"

	"aiworkbench/store"
)

// Server is the MCP HTTP server.
type Server struct {
	store    *store.Store
	listener net.Listener
	mux      *http.ServeMux
}

// jsonrpc types
type request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type response struct {
	JSONRPC string `json:"jsonrpc"`
	ID      any    `json:"id"`
	Result  any    `json:"result,omitempty"`
	Error   *rpcError `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type toolDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

// New creates and starts the MCP server on a random free port.
func New(s *store.Store) (*Server, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("mcp listen: %w", err)
	}

	srv := &Server{
		store:    s,
		listener: ln,
		mux:      http.NewServeMux(),
	}
	srv.mux.HandleFunc("/mcp", srv.handleMCP)

	go func() {
		if err := http.Serve(ln, srv.mux); err != nil && err != http.ErrServerClosed {
			log.Printf("mcp server error: %v", err)
		}
	}()

	log.Printf("MCP server listening on %s", ln.Addr())
	return srv, nil
}

// Addr returns the address the server is listening on (e.g. "127.0.0.1:54321").
func (s *Server) Addr() string {
	return s.listener.Addr().String()
}

// Close shuts down the server.
func (s *Server) Close() error {
	return s.listener.Close()
}

func (s *Server) handleMCP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, nil, -32700, "parse error")
		return
	}

	var result any
	var rpcErr *rpcError

	switch req.Method {
	case "initialize":
		result = map[string]any{
			"protocolVersion": "2024-11-05",
			"serverInfo": map[string]any{
				"name":    "aiworkbench",
				"version": "0.1.0",
			},
			"capabilities": map[string]any{
				"tools": map[string]any{},
			},
		}

	case "tools/list":
		result = map[string]any{"tools": s.toolList()}

	case "tools/call":
		result, rpcErr = s.callTool(req.Params)

	default:
		rpcErr = &rpcError{Code: -32601, Message: "method not found"}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
		Error:   rpcErr,
	})
}

func (s *Server) toolList() []toolDef {
	return []toolDef{
		{
			Name:        "list_tasks",
			Description: "List all tasks for a project",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"project_id": map[string]any{"type": "number", "description": "Project ID"},
				},
				"required": []string{"project_id"},
			},
		},
		{
			Name:        "create_task",
			Description: "Create a new task on the board",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"project_id": map[string]any{"type": "number"},
					"name":       map[string]any{"type": "string"},
					"objective":  map[string]any{"type": "string"},
					"task_type":  map[string]any{"type": "string", "enum": []string{"leaf", "container"}},
					"prompt":     map[string]any{"type": "string"},
				},
				"required": []string{"project_id", "name", "task_type"},
			},
		},
		{
			Name:        "update_task_status",
			Description: "Update the status of a task",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"task_id": map[string]any{"type": "number"},
					"status":  map[string]any{"type": "string", "enum": []string{"planning", "ready", "queued", "running", "done", "failed"}},
				},
				"required": []string{"task_id", "status"},
			},
		},
		{
			Name:        "create_subtask",
			Description: "Create a subtask inside a container task",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"task_id":   map[string]any{"type": "number"},
					"name":      map[string]any{"type": "string"},
					"objective": map[string]any{"type": "string"},
					"prompt":    map[string]any{"type": "string"},
				},
				"required": []string{"task_id", "name"},
			},
		},
		{
			Name:        "set_dependency",
			Description: "Add a dependency edge between two tasks",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"task_id":       map[string]any{"type": "number"},
					"depends_on_id": map[string]any{"type": "number"},
				},
				"required": []string{"task_id", "depends_on_id"},
			},
		},
	}
}

func (s *Server) callTool(raw json.RawMessage) (any, *rpcError) {
	var p struct {
		Name      string         `json:"name"`
		Arguments map[string]any `json:"arguments"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, &rpcError{Code: -32602, Message: "invalid params"}
	}

	args := p.Arguments

	switch p.Name {
	case "list_tasks":
		projectID := int64(args["project_id"].(float64))
		tasks, err := s.store.ListTasks(projectID)
		if err != nil {
			return nil, &rpcError{Code: -32000, Message: err.Error()}
		}
		return toolResult(tasks), nil

	case "create_task":
		projectID := int64(args["project_id"].(float64))
		name := stringArg(args, "name")
		objective := stringArg(args, "objective")
		taskType := stringArg(args, "task_type")
		prompt := stringArg(args, "prompt")
		task, err := s.store.CreateTask(projectID, name, objective, taskType, prompt, 0, 0)
		if err != nil {
			return nil, &rpcError{Code: -32000, Message: err.Error()}
		}
		return toolResult(task), nil

	case "update_task_status":
		taskID := int64(args["task_id"].(float64))
		status := stringArg(args, "status")
		if err := s.store.UpdateTaskStatus(taskID, status); err != nil {
			return nil, &rpcError{Code: -32000, Message: err.Error()}
		}
		return toolResult("ok"), nil

	case "create_subtask":
		taskID := int64(args["task_id"].(float64))
		name := stringArg(args, "name")
		objective := stringArg(args, "objective")
		prompt := stringArg(args, "prompt")
		st, err := s.store.CreateSubtask(taskID, name, objective, prompt)
		if err != nil {
			return nil, &rpcError{Code: -32000, Message: err.Error()}
		}
		return toolResult(st), nil

	case "set_dependency":
		taskID := int64(args["task_id"].(float64))
		dependsOnID := int64(args["depends_on_id"].(float64))
		if err := s.store.AddDependency(taskID, dependsOnID); err != nil {
			return nil, &rpcError{Code: -32000, Message: err.Error()}
		}
		return toolResult("ok"), nil

	default:
		return nil, &rpcError{Code: -32601, Message: "unknown tool: " + p.Name}
	}
}

func toolResult(content any) map[string]any {
	b, _ := json.Marshal(content)
	return map[string]any{
		"content": []map[string]any{
			{"type": "text", "text": string(b)},
		},
	}
}

func stringArg(args map[string]any, key string) string {
	if v, ok := args[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func writeError(w http.ResponseWriter, id any, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &rpcError{Code: code, Message: msg},
	})
}
