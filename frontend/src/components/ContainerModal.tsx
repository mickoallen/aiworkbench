import { useState } from 'react'
import { UpdateTask, DeleteTask, ListSubtasks, UpdateSubtask } from '../api'
import Modal, { Field, Input, Select, Row, Btn } from './Modal'
import SubtaskModal from './SubtaskModal'
import { useToast } from './Toast'
import { useSettings } from './SettingsContext'
import { AGENT_OPTIONS, MODEL_OPTIONS, DEFAULT_MODEL, defaultModelForAgent, agentHasModelList } from '../agentConfig'

interface Props {
  task: any
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function ContainerModal({ task, onClose, onSaved, onDeleted }: Props) {
  const { showToast } = useToast()
  const { settings } = useSettings()
  const [name, setName] = useState(task.name)
  const [agent, setAgent] = useState(task.agent ?? 'claude')
  const [model, setModel] = useState(task.model ?? DEFAULT_MODEL['claude'])
  const [saving, setSaving] = useState(false)
  const [addingSubtask, setAddingSubtask] = useState(false)

  const originalAgent = task.agent ?? 'claude'
  const originalModel = task.model ?? DEFAULT_MODEL['claude']

  function handleAgentChange(v: string) {
    setAgent(v)
    setModel(defaultModelForAgent(v))
  }

  async function save() {
    setSaving(true)
    try {
      await UpdateTask(task.id, name, task.objective ?? '', task.prompt, model, agent, task.status)

      // Offer to cascade agent/model to existing subtasks if either changed
      if ((agent !== originalAgent || model !== originalModel)) {
        const subtasks = await ListSubtasks(task.id)
        if (subtasks && subtasks.length > 0) {
          const apply = confirm(`Apply agent/model to all ${subtasks.length} existing subtask(s)?`)
          if (apply) {
            await Promise.all(
              subtasks.map((st: any) =>
                UpdateSubtask(st.id, st.name, st.objective ?? '', st.prompt, model, agent, st.status)
              )
            )
          }
        }
      }

      onSaved()
    } catch (e: any) { showToast(e?.message ?? 'Failed to save', 'error') }
    setSaving(false)
  }

  async function del() {
    if (settings.confirm_delete !== 'false' && !confirm(`Delete container "${task.name}" and all its subtasks?`)) return
    try {
      await DeleteTask(task.id)
      onDeleted()
    } catch (e: any) { showToast(e?.message ?? 'Failed to delete', 'error') }
  }

  return (
    <>
      <Modal title="container task" onClose={onClose} width={560}>
        <Field label="name">
          <Input value={name} onChange={setName} placeholder="task name" />
        </Field>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="default agent">
              <Select value={agent} onChange={handleAgentChange} options={AGENT_OPTIONS} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="default model">
              {agentHasModelList(agent) ? (
                <Select value={model} onChange={setModel} options={MODEL_OPTIONS[agent]} />
              ) : (
                <Input value={model} onChange={setModel} placeholder="provider/model" />
              )}
            </Field>
          </div>
        </div>

        <div style={{ marginTop: -4 }}>
          <button
            onClick={() => setAddingSubtask(true)}
            style={{
              background: 'transparent', border: '1px dashed #21262d', borderRadius: 6,
              padding: '10px 14px', color: '#484f58', fontSize: 12, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left', width: '100%',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#8b949e' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.color = '#484f58' }}
          >
            + add subtask
          </button>
        </div>

        <Row>
          <Btn danger onClick={del}>delete</Btn>
          <Btn onClick={save} disabled={saving || !name}>{saving ? 'saving…' : 'save'}</Btn>
        </Row>
      </Modal>

      {addingSubtask && (
        <SubtaskModal
          taskID={task.id}
          defaultAgent={agent}
          defaultModel={model}
          onClose={() => setAddingSubtask(false)}
          onSaved={() => { setAddingSubtask(false); onSaved() }}
        />
      )}
    </>
  )
}
