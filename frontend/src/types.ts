export interface Project {
  id: number
  name: string
  path: string
  description: string
  session_branch: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: number
  project_id: number
  name: string
  objective: string
  task_type: 'leaf' | 'container'
  prompt: string
  model: string
  agent: string
  status: 'planning' | 'ready' | 'queued' | 'running' | 'done' | 'failed'
  canvas_x: number
  canvas_y: number
  review_enabled: boolean
  max_rework: number
  rework_count: number
  created_at: string
  updated_at: string
}

export interface Subtask {
  id: number
  task_id: number
  name: string
  objective: string
  prompt: string
  model: string
  agent: string
  status: 'pending' | 'ready' | 'queued' | 'running' | 'done' | 'failed'
  position: number
  branch_name: string
  pr_number: number | null
  pr_url: string
  canvas_x: number
  canvas_y: number
  created_at: string
  updated_at: string
}

export interface TaskDependency {
  task_id: number
  depends_on_id: number
}

export interface QueueItem {
  id: number
  project_id: number
  task_id: number | null
  subtask_id: number | null
  position: number
  status: string
  added_at: string
  started_at: string | null
  finished_at: string | null
  error: string
}
