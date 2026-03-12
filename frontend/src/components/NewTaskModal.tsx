import { useState, useEffect } from 'react'
import { CreateTask, GetSetting } from '../api'
import Modal, { Field, Input, Select, Row, Btn } from './Modal'
import { useToast } from './Toast'

const claudeModelOptions = [
  { value: 'claude-sonnet-4-6', label: 'sonnet 4.6' },
  { value: 'claude-opus-4-6',   label: 'opus 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'haiku 4.5' },
]

const agentOptions = [
  { value: 'claude', label: 'claude code' },
  { value: 'opencode', label: 'opencode' },
]

interface Props {
  projectId: number
  onClose: () => void
  onCreated: () => void
}

export default function NewTaskModal({ projectId, onClose, onCreated }: Props) {
  const { showToast } = useToast()
  const [taskType, setTaskType] = useState<'leaf' | 'container'>('leaf')
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [agent, setAgent] = useState('claude')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    GetSetting('default_agent').then((v: string) => { if (v) setAgent(v) })
  }, [])

  async function create() {
    if (!name) return
    setSaving(true)
    try {
      await CreateTask(projectId, name, objective, taskType, taskType === 'leaf' ? prompt : '', model, agent, 0, 0)
      onCreated()
    } catch (e: any) { showToast(e?.message ?? 'Failed to create task', 'error') }
    setSaving(false)
  }

  return (
    <Modal title="new task" onClose={onClose}>
      <Field label="type">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['leaf', 'container'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTaskType(t)}
              style={{
                flex: 1, padding: '7px 12px', borderRadius: 4, fontSize: 12,
                border: '1px solid #30363d', fontFamily: 'inherit', cursor: 'pointer',
                background: taskType === t ? '#1f6feb' : '#0d1117',
                color: taskType === t ? '#fff' : '#8b949e',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>
      <Field label="name">
        <Input value={name} onChange={setName} placeholder="task name" />
      </Field>
      <Field label="objective">
        <Input value={objective} onChange={setObjective} placeholder="what should be achieved" />
      </Field>
      {taskType === 'leaf' && (
        <Field label="prompt">
          <Input value={prompt} onChange={setPrompt} placeholder="instructions for Claude Code" multiline rows={4} />
        </Field>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="agent">
            <Select value={agent} onChange={(v) => { setAgent(v); if (v === 'claude') setModel('claude-sonnet-4-6') }} options={agentOptions} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="model">
            {agent === 'claude' ? (
              <Select value={model} onChange={setModel} options={claudeModelOptions} />
            ) : (
              <Input value={model} onChange={setModel} placeholder="provider/model" />
            )}
          </Field>
        </div>
      </div>
      <Row>
        <Btn onClick={onClose}>cancel</Btn>
        <Btn onClick={create} disabled={saving || !name}>{saving ? 'creating…' : 'create task'}</Btn>
      </Row>
    </Modal>
  )
}
