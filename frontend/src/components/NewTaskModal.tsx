import { useState } from 'react'
import { CreateTask } from '../api'
import Modal, { Field, Input, Select, Row, Btn } from './Modal'
import { useToast } from './Toast'
import { useSettings } from './SettingsContext'
import { AGENT_OPTIONS, MODEL_OPTIONS, DEFAULT_MODEL, defaultModelForAgent, agentHasModelList } from '../agentConfig'

interface Props {
  projectId: number
  onClose: () => void
  onCreated: () => void
}

export default function NewTaskModal({ projectId, onClose, onCreated }: Props) {
  const { showToast } = useToast()
  const { settings } = useSettings()
  const [taskType, setTaskType] = useState<'leaf' | 'container'>(settings.default_task_type)
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [prompt, setPrompt] = useState('')
  const [agent, setAgent] = useState(settings.default_agent)
  const [model, setModel] = useState(settings.default_model || DEFAULT_MODEL['claude'])
  const [saving, setSaving] = useState(false)

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
            <Select value={agent} onChange={(v) => { setAgent(v); setModel(defaultModelForAgent(v)) }} options={AGENT_OPTIONS} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="model">
            {agentHasModelList(agent) ? (
              <Select value={model} onChange={setModel} options={MODEL_OPTIONS[agent]} />
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
