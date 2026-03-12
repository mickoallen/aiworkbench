export const AGENT_OPTIONS = [
  { value: 'claude',    label: 'claude code' },
  { value: 'opencode',  label: 'opencode' },
]

export const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  claude: [
    { value: 'claude-sonnet-4-6',         label: 'sonnet 4.6' },
    { value: 'claude-opus-4-6',           label: 'opus 4.6' },
    { value: 'claude-haiku-4-5-20251001', label: 'haiku 4.5' },
  ],
}

export const DEFAULT_MODEL: Record<string, string> = {
  claude:   'claude-sonnet-4-6',
  opencode: '',
}

/** Returns the default model for an agent, or empty string if unknown. */
export function defaultModelForAgent(agent: string): string {
  return DEFAULT_MODEL[agent] ?? ''
}

/** Returns true if models for this agent are a fixed list (use Select), false for free-text. */
export function agentHasModelList(agent: string): boolean {
  return !!MODEL_OPTIONS[agent]
}
