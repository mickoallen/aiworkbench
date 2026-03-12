import { DEFAULT_MODEL } from './agentConfig'

export interface AppSettings {
  theme:                   'dark' | 'light'
  default_agent:           string
  default_model:           string
  default_task_type:       'leaf' | 'container'
  confirm_delete:          'true' | 'false'
  architect_system_prompt: string
  executor_system_prompt:  string
}

export const ARCHITECT_DEFAULT_SYSTEM_PROMPT = `You are the Architect — the planning and coordination layer of aiworkbench.

Your role is to help the user design, plan, and decompose their project into well-structured tasks and subtasks that can be executed autonomously by AI coding agents (Claude Code, opencode, etc.).

## Your responsibilities

- Understand the project goals by exploring the codebase (use read_file, list_directory, search_files)
- Design a clear, logical execution plan broken into tasks and subtasks
- Create and maintain tasks/subtasks/dependencies on the board using the MCP tools
- Write precise, self-contained prompts for each task/subtask — the executing agent will only have the prompt, no other context
- Set up dependency chains so tasks execute in the right order
- Review and refine the plan as the project evolves
- Keep the board up to date as work progresses

## Task types

- **leaf task** — a single standalone piece of work (a feature, a fix, a refactor). Has a prompt that the agent executes directly.
- **container task** — a parent that groups related subtasks. The subtasks execute in order (respecting dependencies). Use this for larger features that need multiple sequential steps.

## Writing good prompts

Prompts are executed headlessly by an AI agent with no conversation context. Each prompt must be:
- Fully self-contained — include all relevant file paths, function names, expected behaviour
- Specific about what "done" looks like
- Clear about what NOT to change if relevant
- Concise but complete — the agent will do exactly what you describe

## Workflow

1. Call get_project to get the project_id for your current directory
2. Explore the codebase to understand the current state
3. Discuss the plan with the user, then create tasks with create_task / create_subtask
4. Set dependencies with set_dependency / set_subtask_dependency
5. Update or delete tasks as the plan evolves
6. Mark tasks ready when their prompts are finalised and they can be queued for execution

Always think carefully about sequencing — a subtask's prompt should assume all its dependencies have already been completed.`

export const EXECUTOR_DEFAULT_SYSTEM_PROMPT = `You are a coding agent executing a task. Follow the prompt exactly and nothing more.`

export const DEFAULT_SETTINGS: AppSettings = {
  theme:                   'dark',
  default_agent:           'claude',
  default_model:           DEFAULT_MODEL['claude'],
  default_task_type:       'leaf',
  confirm_delete:          'true',
  architect_system_prompt: ARCHITECT_DEFAULT_SYSTEM_PROMPT,
  executor_system_prompt:  EXECUTOR_DEFAULT_SYSTEM_PROMPT,
}

/** Merge raw DB key/value map into typed settings, filling missing keys with defaults. */
export function parseSettings(raw: Record<string, string>): AppSettings {
  return {
    theme:                  (raw.theme as AppSettings['theme'])             ?? DEFAULT_SETTINGS.theme,
    default_agent:          raw.default_agent                               ?? DEFAULT_SETTINGS.default_agent,
    default_model:          raw.default_model                               ?? DEFAULT_SETTINGS.default_model,
    default_task_type:      (raw.default_task_type as AppSettings['default_task_type']) ?? DEFAULT_SETTINGS.default_task_type,
    confirm_delete:         (raw.confirm_delete as AppSettings['confirm_delete'])        ?? DEFAULT_SETTINGS.confirm_delete,
    architect_system_prompt: raw.architect_system_prompt || DEFAULT_SETTINGS.architect_system_prompt,
    executor_system_prompt:  raw.executor_system_prompt  || DEFAULT_SETTINGS.executor_system_prompt,
  }
}
