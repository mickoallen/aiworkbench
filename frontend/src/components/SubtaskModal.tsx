import { useState } from 'react'
import { CreateSubtask, UpdateSubtask, DeleteSubtask } from '../api'
import Modal, { Field, Input, Select, Row, Btn } from './Modal'

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'sonnet 4.6' },
  { value: 'claude-opus-4-6',   label: 'opus 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'haiku 4.5' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: 'pending' },
  { value: 'ready',   label: 'ready' },
  { value: 'queued',  label: 'queued' },
  { value: 'running', label: 'running' },
  { value: 'done',    label: 'done' },
  { value: 'failed',  label: 'failed' },
]

interface Props {
  // Pass taskID + no subtask to create; pass subtask to edit
  taskID: number
  subtask?: any
  onClose: () => void
  onSaved: () => void
  onDeleted?: () => void
}

export default function SubtaskModal({ taskID, subtask, onClose, onSaved, onDeleted }: Props) {
  const editing = !!subtask
  const [name, setName] = useState(subtask?.name ?? '')
  const [prompt, setPrompt] = useState(subtask?.prompt ?? '')
  const [model, setModel] = useState(subtask?.model ?? 'claude-sonnet-4-6')
  const [status, setStatus] = useState(subtask?.status ?? 'pending')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    if (editing) {
      await UpdateSubtask(subtask.id, name, subtask?.objective ?? '', prompt, model, status)
    } else {
      await CreateSubtask(taskID, name, '', prompt, model)
    }
    setSaving(false)
    onSaved()
  }

  async function del() {
    if (!confirm(`Delete subtask "${subtask?.name}"?`)) return
    await DeleteSubtask(subtask.id)
    onDeleted?.()
  }

  return (
    <Modal title={editing ? 'edit subtask' : 'new subtask'} onClose={onClose} width={560}>
      <Field label="name">
        <Input value={name} onChange={setName} placeholder="subtask name" />
      </Field>
      <Field label="prompt">
        <Input value={prompt} onChange={setPrompt} placeholder="instructions for Claude Code" multiline rows={8} />
      </Field>
      <Field label="model">
        <Select value={model} onChange={setModel} options={MODEL_OPTIONS} />
      </Field>
      {editing && (
        <Field label="status">
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </Field>
      )}
      <Row>
        <Btn onClick={onClose}>cancel</Btn>
        {editing && <Btn danger onClick={del}>delete</Btn>}
        <Btn onClick={save} disabled={saving || !name}>{saving ? 'saving…' : editing ? 'save' : 'add'}</Btn>
      </Row>
    </Modal>
  )
}
