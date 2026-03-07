import { useState } from 'react'
import { UpdateTask, DeleteTask, CreateSubtask, UpdateSubtask, DeleteSubtask, ListSubtasks } from '../api'
import Modal, { Field, Input, Row, Btn } from './Modal'

interface Props {
  task: any
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function ContainerModal({ task, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(task.name)
  const [objective, setObjective] = useState(task.objective)
  const [saving, setSaving] = useState(false)

  // Subtask form
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [stName, setStName] = useState('')
  const [stObjective, setStObjective] = useState('')
  const [stPrompt, setStPrompt] = useState('')

  // Inline subtask editing
  const [editingSubtask, setEditingSubtask] = useState<any | null>(null)
  const [editStName, setEditStName] = useState('')
  const [editStObjective, setEditStObjective] = useState('')
  const [editStPrompt, setEditStPrompt] = useState('')

  async function save() {
    setSaving(true)
    await UpdateTask(task.id, name, objective, task.prompt, task.status)
    setSaving(false)
    onSaved()
  }

  async function del() {
    if (!confirm(`Delete container "${task.name}" and all its subtasks?`)) return
    await DeleteTask(task.id)
    onDeleted()
  }

  async function addSubtask() {
    if (!stName) return
    await CreateSubtask(task.id, stName, stObjective, stPrompt)
    setStName(''); setStObjective(''); setStPrompt('')
    setAddingSubtask(false)
    onSaved()
  }

  function startEditSubtask(st: any) {
    setEditingSubtask(st)
    setEditStName(st.name)
    setEditStObjective(st.objective)
    setEditStPrompt(st.prompt)
  }

  async function saveSubtask() {
    if (!editingSubtask) return
    await UpdateSubtask(editingSubtask.id, editStName, editStObjective, editStPrompt, editingSubtask.status)
    setEditingSubtask(null)
    onSaved()
  }

  async function delSubtask(st: any) {
    if (!confirm(`Delete subtask "${st.name}"?`)) return
    await DeleteSubtask(st.id)
    onSaved()
  }

  const subtasks: any[] = task._subtasks ?? []

  return (
    <Modal title="container task" onClose={onClose} width={520}>
      <Field label="name">
        <Input value={name} onChange={setName} placeholder="task name" />
      </Field>
      <Field label="objective">
        <Input value={objective} onChange={setObjective} placeholder="what should be achieved" />
      </Field>

      {/* Subtasks */}
      <div>
        <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 6 }}>subtasks</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {subtasks.map((st: any) => (
            <div key={st.id}>
              {editingSubtask?.id === st.id ? (
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Input value={editStName} onChange={setEditStName} placeholder="name" />
                  <Input value={editStObjective} onChange={setEditStObjective} placeholder="objective" />
                  <Input value={editStPrompt} onChange={setEditStPrompt} placeholder="prompt" multiline rows={3} />
                  <Row>
                    <Btn onClick={() => setEditingSubtask(null)}>cancel</Btn>
                    <Btn onClick={saveSubtask} disabled={!editStName}>save</Btn>
                  </Row>
                </div>
              ) : (
                <div style={{
                  background: '#0d1117', border: '1px solid #21262d', borderRadius: 3,
                  padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ color: '#8b949e', fontSize: 10 }}>[{st.status}]</span>
                  <span style={{ color: '#e6edf3', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
                  <button onClick={() => startEditSubtask(st)} style={iconBtn}>edit</button>
                  <button onClick={() => delSubtask(st)} style={{ ...iconBtn, color: '#f85149' }}>del</button>
                </div>
              )}
            </div>
          ))}

          {addingSubtask ? (
            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Input value={stName} onChange={setStName} placeholder="subtask name" />
              <Input value={stObjective} onChange={setStObjective} placeholder="objective" />
              <Input value={stPrompt} onChange={setStPrompt} placeholder="prompt for Claude Code" multiline rows={3} />
              <Row>
                <Btn onClick={() => setAddingSubtask(false)}>cancel</Btn>
                <Btn onClick={addSubtask} disabled={!stName}>add</Btn>
              </Row>
            </div>
          ) : (
            <button
              onClick={() => setAddingSubtask(true)}
              style={{
                background: 'transparent', border: '1px dashed #30363d', borderRadius: 3,
                padding: '6px 10px', color: '#8b949e', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              + add subtask
            </button>
          )}
        </div>
      </div>

      <Row>
        <Btn danger onClick={del}>delete</Btn>
        <Btn onClick={save} disabled={saving || !name}>{saving ? 'saving…' : 'save'}</Btn>
      </Row>
    </Modal>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e', fontSize: 11,
  cursor: 'pointer', padding: '1px 4px', fontFamily: 'inherit',
}
