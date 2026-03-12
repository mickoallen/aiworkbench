import { useState, useEffect, useRef } from 'react'
import { CreateSubtask, UpdateSubtask, DeleteSubtask, GetQueueItemForSubtask, GetSetting } from '../api'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import Modal, { Field, Input, Select, Row, Btn } from './Modal'
import { useToast } from './Toast'

const CLAUDE_MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'sonnet 4.6' },
  { value: 'claude-opus-4-6',   label: 'opus 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'haiku 4.5' },
]

const AGENT_OPTIONS = [
  { value: 'claude', label: 'claude code' },
  { value: 'opencode', label: 'opencode' },
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
  taskID: number
  subtask?: any
  onClose: () => void
  onSaved: () => void
  onDeleted?: () => void
}

export default function SubtaskModal({ taskID, subtask, onClose, onSaved, onDeleted }: Props) {
  const { showToast } = useToast()
  const editing = !!subtask
  const isDone = subtask?.status === 'done'
  const [name, setName] = useState(subtask?.name ?? '')
  const [prompt, setPrompt] = useState(subtask?.prompt ?? '')
  const [model, setModel] = useState(subtask?.model ?? 'claude-sonnet-4-6')
  const [agent, setAgent] = useState(subtask?.agent ?? 'claude')
  const [status, setStatus] = useState(subtask?.status ?? 'pending')
  const [saving, setSaving] = useState(false)
  const [output, setOutput] = useState('')
  const [outputError, setOutputError] = useState('')
  const [queueItemID, setQueueItemID] = useState<number | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  // Load default agent for new subtasks
  useEffect(() => {
    if (!editing) {
      GetSetting('default_agent').then((v: string) => { if (v) setAgent(v) })
    }
  }, [editing])

  // Load execution output for existing subtasks
  useEffect(() => {
    if (!subtask?.id) return
    GetQueueItemForSubtask(subtask.id).then((item) => {
      if (!item) return
      setQueueItemID(item.id)
      setOutput(item.output ?? '')
      setOutputError(item.error ?? '')
      if (item.output || item.error || item.status === 'running') {
        setShowOutput(true)
      }
    })
  }, [subtask?.id])

  // Stream live output from runner
  useEffect(() => {
    if (queueItemID == null) return
    const unsub = EventsOn('runner:output', (itemID: number, data: string) => {
      if (itemID !== queueItemID) return
      setOutput((prev) => prev + data)
      setShowOutput(true)
    })
    return () => unsub()
  }, [queueItemID])

  // Also listen for new queue items being created for this subtask
  useEffect(() => {
    if (!subtask?.id) return
    const unsub = EventsOn('board:changed', () => {
      GetQueueItemForSubtask(subtask.id).then((item) => {
        if (!item) return
        if (item.id !== queueItemID) {
          setQueueItemID(item.id)
          setOutput(item.output ?? '')
          setOutputError(item.error ?? '')
          if (item.status === 'running') setShowOutput(true)
        }
      })
    })
    return () => unsub()
  }, [subtask?.id, queueItemID])

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  async function save() {
    setSaving(true)
    try {
      if (editing) {
        await UpdateSubtask(subtask.id, name, subtask?.objective ?? '', prompt, model, agent, status)
      } else {
        await CreateSubtask(taskID, name, '', prompt, model, agent)
      }
      onSaved()
    } catch (e: any) { showToast(e?.message ?? 'Failed to save subtask', 'error') }
    setSaving(false)
  }

  async function del() {
    if (!confirm(`Delete subtask "${subtask?.name}"?`)) return
    try {
      await DeleteSubtask(subtask.id)
      onDeleted?.()
    } catch (e: any) { showToast(e?.message ?? 'Failed to delete subtask', 'error') }
  }

  return (
    <Modal title={editing ? 'edit subtask' : 'new subtask'} onClose={onClose} width={640}>
      <Field label="name">
        <Input value={name} onChange={setName} placeholder="subtask name" disabled={isDone} />
      </Field>
      <Field label="prompt">
        <Input value={prompt} onChange={setPrompt} placeholder="instructions for Claude Code" multiline rows={8} disabled={isDone} />
      </Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="agent">
            <Select value={agent} onChange={(v) => { setAgent(v); if (v === 'claude') setModel('claude-sonnet-4-6') }} options={AGENT_OPTIONS} disabled={isDone} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="model">
            {agent === 'claude' ? (
              <Select value={model} onChange={setModel} options={CLAUDE_MODEL_OPTIONS} disabled={isDone} />
            ) : (
              <Input value={model} onChange={setModel} placeholder="provider/model" disabled={isDone} />
            )}
          </Field>
        </div>
        {editing && (
          <div style={{ flex: 1 }}>
            <Field label="status">
              <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} disabled={isDone} />
            </Field>
          </div>
        )}
      </div>
      {/* Execution output */}
      {editing && (output || outputError) && (
        <div>
          <div
            onClick={() => setShowOutput(!showOutput)}
            style={{
              color: '#6e7681', fontSize: 11, fontWeight: 500, marginBottom: 6,
              cursor: 'pointer', userSelect: 'none',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 9 }}>{showOutput ? '▼' : '▶'}</span>
            execution output
            {outputError && <span style={{ color: '#f85149', fontWeight: 400 }}>— error</span>}
          </div>
          {showOutput && (
            <div style={{
              background: '#0d1117',
              border: `1px solid ${outputError ? '#f8514933' : '#21262d'}`,
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              {outputError && (
                <div style={{
                  padding: '8px 12px',
                  color: '#f85149', fontSize: 11, lineHeight: 1.5,
                  borderBottom: output ? '1px solid #21262d' : 'none',
                }}>
                  {outputError}
                </div>
              )}
              {output && (
                <pre
                  ref={outputRef}
                  style={{
                    margin: 0, padding: '8px 12px',
                    color: '#8b949e', fontSize: 11, lineHeight: 1.5,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxHeight: 300, overflowY: 'auto',
                    fontFamily: 'inherit',
                  }}
                >
                  {output}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      <Row>
        <Btn onClick={onClose}>cancel</Btn>
        {editing && <Btn danger onClick={del}>delete</Btn>}
        {!isDone && <Btn onClick={save} disabled={saving || !name}>{saving ? 'saving…' : editing ? 'save' : 'add'}</Btn>}
      </Row>
    </Modal>
  )
}
