import { useState } from 'react'
import { UpdateTask, DeleteTask } from '../api'
import Modal, { Field, Input, Select, Row, Btn } from './Modal'

const statusOptions = [
  { value: 'planning', label: '[planning]' },
  { value: 'ready',    label: '[ready]' },
  { value: 'queued',   label: '[queued]' },
  { value: 'running',  label: '[running]' },
  { value: 'done',     label: '[done]' },
  { value: 'failed',   label: '[failed]' },
]

interface Props {
  task: any
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function TaskModal({ task, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(task.name)
  const [objective, setObjective] = useState(task.objective)
  const [prompt, setPrompt] = useState(task.prompt)
  const [status, setStatus] = useState(task.status)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await UpdateTask(task.id, name, objective, prompt, status)
    setSaving(false)
    onSaved()
  }

  async function del() {
    if (!confirm(`Delete task "${task.name}"?`)) return
    await DeleteTask(task.id)
    onDeleted()
  }

  return (
    <Modal title="leaf task" onClose={onClose}>
      <Field label="name">
        <Input value={name} onChange={setName} placeholder="task name" />
      </Field>
      <Field label="objective">
        <Input value={objective} onChange={setObjective} placeholder="what should be achieved" />
      </Field>
      <Field label="prompt">
        <Input value={prompt} onChange={setPrompt} placeholder="instructions for Claude Code" multiline rows={5} />
      </Field>
      <Field label="status">
        <Select value={status} onChange={setStatus} options={statusOptions} />
      </Field>
      <Row>
        <Btn danger onClick={del}>delete</Btn>
        <Btn onClick={save} disabled={saving || !name}>{saving ? 'saving…' : 'save'}</Btn>
      </Row>
    </Modal>
  )
}
