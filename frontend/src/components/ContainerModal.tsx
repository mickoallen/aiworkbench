import { useState } from 'react'
import { UpdateTask, DeleteTask } from '../api'
import Modal, { Field, Input, Row, Btn } from './Modal'
import SubtaskModal from './SubtaskModal'

interface Props {
  task: any
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

const statusColor: Record<string, string> = {
  pending: '#6e7681',
  queued:  '#d29922',
  running: '#3fb950',
  done:    '#3fb950',
  failed:  '#f85149',
}

export default function ContainerModal({ task, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(task.name)
  const [saving, setSaving] = useState(false)
  const [editingSubtask, setEditingSubtask] = useState<any | null>(null)
  const [addingSubtask, setAddingSubtask] = useState(false)

  const subtasks: any[] = task._subtasks ?? []

  async function save() {
    setSaving(true)
    await UpdateTask(task.id, name, task.objective ?? '', task.prompt, task.model ?? '', task.status)
    setSaving(false)
    onSaved()
  }

  async function del() {
    if (!confirm(`Delete container "${task.name}" and all its subtasks?`)) return
    await DeleteTask(task.id)
    onDeleted()
  }

  return (
    <>
      <Modal title="container task" onClose={onClose} width={560}>
        <Field label="name">
          <Input value={name} onChange={setName} placeholder="task name" />
        </Field>

        <div>
          <div style={{
            color: '#6e7681', fontSize: 11, fontWeight: 500, marginBottom: 10,
          }}>
            subtasks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {subtasks.map((st: any) => (
              <div
                key={st.id}
                onClick={() => setEditingSubtask(st)}
                style={{
                  background: '#0d1117', border: '1px solid #21262d', borderRadius: 6,
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#30363d')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#21262d')}
              >
                <span style={{
                  color: statusColor[st.status] ?? '#6e7681',
                  fontSize: 9, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  flexShrink: 0, width: 50,
                }}>
                  {st.status}
                </span>
                <span style={{
                  color: '#e6edf3', fontSize: 12, flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {st.name}
                </span>
                <span style={{ color: '#30363d', fontSize: 11 }}>→</span>
              </div>
            ))}

            <button
              onClick={() => setAddingSubtask(true)}
              style={{
                background: 'transparent', border: '1px dashed #21262d', borderRadius: 6,
                padding: '10px 14px', color: '#484f58', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left', marginTop: subtasks.length ? 2 : 0,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#8b949e' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.color = '#484f58' }}
            >
              + add subtask
            </button>
          </div>
        </div>

        <Row>
          <Btn danger onClick={del}>delete</Btn>
          <Btn onClick={save} disabled={saving || !name}>{saving ? 'saving…' : 'save'}</Btn>
        </Row>
      </Modal>

      {editingSubtask && (
        <SubtaskModal
          taskID={task.id}
          subtask={editingSubtask}
          onClose={() => setEditingSubtask(null)}
          onSaved={() => { setEditingSubtask(null); onSaved() }}
          onDeleted={() => { setEditingSubtask(null); onSaved() }}
        />
      )}

      {addingSubtask && (
        <SubtaskModal
          taskID={task.id}
          onClose={() => setAddingSubtask(false)}
          onSaved={() => { setAddingSubtask(false); onSaved() }}
        />
      )}
    </>
  )
}
