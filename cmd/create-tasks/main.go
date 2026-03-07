package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

type jsonrpcRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

type jsonrpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func callMCP(addr, method string, params interface{}) (json.RawMessage, error) {
	req := jsonrpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  method,
		Params:  params,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(
		fmt.Sprintf("http://%s/mcp", addr),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var jresp jsonrpcResponse
	if err := json.Unmarshal(respBody, &jresp); err != nil {
		return nil, err
	}

	if jresp.Error != nil {
		return nil, fmt.Errorf("rpc error: %s", jresp.Error.Message)
	}

	return jresp.Result, nil
}

func main() {
	addr := flag.String("addr", "", "MCP server address (e.g., 127.0.0.1:54321)")
	projectID := flag.Int64("project", 1, "Project ID")
	flag.Parse()

	if *addr == "" {
		log.Fatal("Usage: create-tasks -addr <mcp-addr> [-project <id>]")
	}

	// Create task 1
	task1Params := map[string]interface{}{
		"project_id": *projectID,
		"name":       "Implement user authentication",
		"task_type":  "leaf",
		"objective":  "Add OAuth2 login flow",
		"prompt":     "Create a login page with OAuth2 support",
	}

	fmt.Println("Creating Task 1...")
	result1, err := callMCP(*addr, "tools/call", map[string]interface{}{
		"name":      "create_task",
		"arguments": task1Params,
	})
	if err != nil {
		log.Fatalf("Failed to create task 1: %v", err)
	}
	fmt.Printf("Task 1 created:\n%s\n\n", string(result1))

	// Create task 2
	task2Params := map[string]interface{}{
		"project_id": *projectID,
		"name":       "Add unit tests",
		"task_type":  "container",
		"objective":  "Improve code coverage to 80%",
		"prompt":     "Write comprehensive unit tests for core modules",
	}

	fmt.Println("Creating Task 2...")
	result2, err := callMCP(*addr, "tools/call", map[string]interface{}{
		"name":      "create_task",
		"arguments": task2Params,
	})
	if err != nil {
		log.Fatalf("Failed to create task 2: %v", err)
	}
	fmt.Printf("Task 2 created:\n%s\n", string(result2))
}
