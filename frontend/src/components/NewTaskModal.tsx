import { useState } from 'react'
import { CreateTask } from '../api'
import Modal, { Field, Input, Row, Btn } from './Modal'

interface Props {
  projectId: number
  onClose: () => void
  onCreated: () => void
}

export default function NewTaskModal({ projectId, onClose, onCreated }: Props) {
  const [taskType, setTaskType] = useState<'leaf' | 'container'>('leaf')
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!name) return
    setSaving(true)
    await CreateTask(projectId, name, objective, taskType, taskType === 'leaf' ? prompt : '', 0, 0)
    setSaving(false)
    onCreated()
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
      <Row>
        <Btn onClick={onClose}>cancel</Btn>
        <Btn onClick={create} disabled={saving || !name}>{saving ? 'creating…' : 'create task'}</Btn>
      </Row>
    </Modal>
  )
}
