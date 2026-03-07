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

export default function ContainerModal({ task, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(task.name)
  const [saving, setSaving] = useState(false)
  const [editingSubtask, setEditingSubtask] = useState<any | null>(null)
  const [addingSubtask, setAddingSubtask] = useState(false)

  const subtasks: any[] = task._subtasks ?? []

  async function save() {
    setSaving(true)
    await UpdateTask(task.id, name, task.objective ?? '', task.prompt, task.status)
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
      <Modal title="container task" onClose={onClose} width={540}>
        <Field label="name">
          <Input value={name} onChange={setName} placeholder="task name" />
        </Field>
        <div>
          <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 6 }}>subtasks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {subtasks.map((st: any) => (
              <div
                key={st.id}
                style={{
                  background: '#0d1117', border: '1px solid #21262d', borderRadius: 3,
                  padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{ color: '#484f58', fontSize: 10, flexShrink: 0 }}>[{st.status}]</span>
                <span style={{
                  color: '#e6edf3', fontSize: 12, flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {st.name}
                </span>
                <button onClick={() => setEditingSubtask(st)} style={actionBtn}>edit</button>
              </div>
            ))}

            <button
              onClick={() => setAddingSubtask(true)}
              style={{
                background: 'transparent', border: '1px dashed #30363d', borderRadius: 3,
                padding: '7px 10px', color: '#8b949e', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left', marginTop: subtasks.length ? 4 : 0,
              }}
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

const actionBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e', fontSize: 11,
  cursor: 'pointer', padding: '1px 6px', fontFamily: 'inherit',
}
