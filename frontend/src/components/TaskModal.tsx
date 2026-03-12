import { useState, useEffect, useRef } from 'react'
import { UpdateTask, DeleteTask, AddTaskToQueueWithDeps, GetQueueItemForTask } from '../api'
import { EventsOn } from '../../wailsjs/runtime/runtime'
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
  const { showToast } = useToast()
  const [name, setName] = useState(task.name)
  const [prompt, setPrompt] = useState(task.prompt)
  const [model, setModel] = useState(task.model || 'claude-sonnet-4-6')
  const [agent, setAgent] = useState(task.agent || 'claude')
  const [status, setStatus] = useState(task.status)
  const [saving, setSaving] = useState(false)
  const [queuing, setQueuing] = useState(false)
  const [output, setOutput] = useState('')
  const [outputError, setOutputError] = useState('')
  const [queueItemID, setQueueItemID] = useState<number | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  // Load execution output
  useEffect(() => {
    GetQueueItemForTask(task.id).then((item) => {
      if (!item) return
      setQueueItemID(item.id)
      setOutput(item.output ?? '')
      setOutputError(item.error ?? '')
      if (item.output || item.error || item.status === 'running') setShowOutput(true)
    })
  }, [task.id])

  // Stream live output
  useEffect(() => {
    if (queueItemID == null) return
    const unsub = EventsOn('runner:output', (itemID: number, data: string) => {
      if (itemID !== queueItemID) return
      setOutput((prev) => prev + data)
      setShowOutput(true)
    })
    return () => unsub()
  }, [queueItemID])

  // Track new queue items
  useEffect(() => {
    const unsub = EventsOn('board:changed', () => {
      GetQueueItemForTask(task.id).then((item) => {
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
  }, [task.id, queueItemID])

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [output])

  async function save() {
    setSaving(true)
    try {
      await UpdateTask(task.id, name, task.objective ?? '', prompt, model, agent, status)
      onSaved()
    } catch (e: any) { showToast(e?.message ?? 'Failed to save task', 'error') }
    setSaving(false)
  }

  async function queue() {
    setQueuing(true)
    try {
      await AddTaskToQueueWithDeps(task.project_id, task.id)
      onClose()
    } catch (e: any) { showToast(e?.message ?? 'Failed to queue task', 'error') }
    setQueuing(false)
  }

  async function del() {
    if (!confirm(`Delete task "${task.name}"?`)) return
    try {
      await DeleteTask(task.id)
      onDeleted()
    } catch (e: any) { showToast(e?.message ?? 'Failed to delete task', 'error') }
  }

  return (
    <Modal title="leaf task" onClose={onClose}>
      <Field label="name">
        <Input value={name} onChange={setName} placeholder="task name" />
      </Field>
      <Field label="prompt">
        <Input value={prompt} onChange={setPrompt} placeholder="instructions for Claude Code" multiline rows={5} />
      </Field>
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
        <div style={{ flex: 1 }}>
          <Field label="status">
            <Select value={status} onChange={setStatus} options={statusOptions} />
          </Field>
        </div>
      </div>
      {/* Execution output */}
      {(output || outputError) && (
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
        <Btn danger onClick={del}>delete</Btn>
        {status !== 'done' && (
          <Btn onClick={queue} disabled={queuing || !prompt}>{queuing ? 'queuing…' : '+ queue'}</Btn>
        )}
        <Btn onClick={save} disabled={saving || !name || status === 'done'}>{saving ? 'saving…' : 'save'}</Btn>
      </Row>
    </Modal>
  )
}
