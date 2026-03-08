import { useCallback, useEffect, useState } from 'react'
import { store } from '../../wailsjs/go/models'
import { ListQueue, ListTasks, ListSubtasks, RemoveFromQueueCascade, RetryQueueItem, RunnerStart, RunnerStop, RunnerStatus, RunnerHaltedReason } from '../api'
import { EventsOn } from '../../wailsjs/runtime/runtime'

interface Props {
  projectId: number
}

const statusColor: Record<string, string> = {
  pending:   '#8b949e',
  running:   '#f0883e',
  done:      '#3fb950',
  failed:    '#f85149',
  cancelled: '#484f58',
}

const statusDot: Record<string, string> = {
  pending:   '○',
  running:   '◉',
  done:      '●',
  failed:    '✕',
  cancelled: '◌',
}

export default function QueuePanel({ projectId }: Props) {
  const [items, setItems] = useState<store.QueueItem[]>([])
  const [tasks, setTasks] = useState<store.Task[]>([])
  const [subtaskMap, setSubtaskMap] = useState<Record<number, store.Subtask>>({})
  const [running, setRunning] = useState(false)
  const [haltReason, setHaltReason] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [q, t, r, h] = await Promise.all([
      ListQueue(projectId),
      ListTasks(projectId),
      RunnerStatus(projectId),
      RunnerHaltedReason(projectId),
    ])
    setItems(q ?? [])
    setTasks(t ?? [])
    setRunning(r)
    setHaltReason(h ?? '')

    const containers = (t ?? []).filter((tk: store.Task) => tk.task_type === 'container')
    const allSubtasks = await Promise.all(containers.map((tk: store.Task) => ListSubtasks(tk.id)))
    const map: Record<number, store.Subtask> = {}
    allSubtasks.flat().forEach((st) => { if (st) map[st.id] = st })
    setSubtaskMap(map)
  }, [projectId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const unsub = EventsOn('board:changed', () => load())
    return () => unsub()
  }, [load])

  async function toggleRunner() {
    if (running) {
      await RunnerStop(projectId)
    } else {
      await RunnerStart(projectId)
    }
    load()
  }

  async function remove(id: number) {
    await RemoveFromQueueCascade(id)
    load()
  }

  async function retry(id: number) {
    await RetryQueueItem(id, projectId)
    load()
  }

  function taskName(item: store.QueueItem): string {
    if (item.task_id) {
      const t = tasks.find((t) => t.id === item.task_id)
      return t ? t.name : `task #${item.task_id}`
    }
    if (item.subtask_id) {
      const st = subtaskMap[item.subtask_id]
      return st ? st.name : `subtask #${item.subtask_id}`
    }
    return `item #${item.id}`
  }

  const pending = items.filter((i) => i.status === 'pending').length
  const failed  = items.filter((i) => i.status === 'failed').length
  const hasActive = items.some((i) => i.status === 'running')
  const halted = !!haltReason

  return (
    <div style={{
      width: 260, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid #21262d',
      background: '#0d1117',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 40, flexShrink: 0,
        borderBottom: '1px solid #21262d',
      }}>
        <span style={{ color: '#e6edf3', fontSize: 12, fontWeight: 600, flex: 1 }}>
          queue
          {pending > 0 && (
            <span style={{
              marginLeft: 6, background: '#1f6feb', color: '#fff',
              borderRadius: 10, fontSize: 10, padding: '1px 6px',
            }}>{pending}</span>
          )}
          {failed > 0 && (
            <span style={{
              marginLeft: 4, background: '#f8514922', color: '#f85149',
              borderRadius: 10, fontSize: 10, padding: '1px 6px',
            }}>{failed} failed</span>
          )}
        </span>

        <button
          onClick={load}
          title="refresh"
          style={iconBtn}
        >↺</button>

        <button
          onClick={toggleRunner}
          title={running ? 'stop runner' : 'start runner'}
          style={{
            ...iconBtn,
            color: halted ? '#d29922' : running ? '#f85149' : '#3fb950',
          }}
        >
          {running ? '■' : '▶'}
        </button>
      </div>

      {/* Runner status */}
      <div style={{
        padding: '4px 12px', fontSize: 10,
        color: halted ? '#d29922' : hasActive ? '#f0883e' : (running ? '#3fb950' : '#484f58'),
        borderBottom: '1px solid #21262d',
      }}>
        {halted ? 'halted — task failed' : hasActive ? 'running task…' : (running ? 'waiting for tasks' : 'runner stopped')}
      </div>

      {/* Halt banner */}
      {halted && (
        <div style={{
          padding: '8px 12px', fontSize: 10,
          background: '#d2992211', borderBottom: '1px solid #d2992233',
          color: '#d29922', lineHeight: 1.4,
        }}>
          {haltReason}
          <div style={{ marginTop: 4, color: '#8b949e' }}>
            retry the failed item or remove it to resume
          </div>
        </div>
      )}

      {/* Queue list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {items.length === 0 && (
          <div style={{ color: '#484f58', fontSize: 11, padding: '12px 14px' }}>
            no items in queue
          </div>
        )}
        {items.map((item) => {
          const isFailed = item.status === 'failed'
          return (
            <div key={item.id}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', cursor: 'pointer',
                  background: expanded === item.id ? '#161b22'
                    : isFailed ? '#f8514908' : 'transparent',
                }}
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              >
                <span style={{ color: statusColor[item.status] ?? '#8b949e', fontSize: 12, flexShrink: 0 }}>
                  {statusDot[item.status] ?? '?'}
                </span>
                <span style={{
                  color: '#e6edf3', fontSize: 11, flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {taskName(item)}
                </span>
                <span style={{ color: statusColor[item.status] ?? '#8b949e', fontSize: 10 }}>
                  {item.status}
                </span>
                {isFailed && (
                  <button
                    onClick={(e) => { e.stopPropagation(); retry(item.id) }}
                    title="retry"
                    style={{ ...iconBtn, fontSize: 11, color: '#d29922' }}
                  >↻</button>
                )}
                {(item.status === 'pending' || item.status === 'done' || isFailed) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(item.id) }}
                    title="remove"
                    style={{ ...iconBtn, fontSize: 13, color: '#484f58' }}
                  >×</button>
                )}
              </div>

              {/* Expanded output / error */}
              {expanded === item.id && (item.output || item.error) && (
                <div style={{
                  margin: '0 8px 6px',
                  background: '#161b22',
                  border: `1px solid ${isFailed ? '#f8514933' : '#21262d'}`,
                  borderRadius: 4,
                  padding: '8px 10px',
                  maxHeight: 220,
                  overflowY: 'auto',
                }}>
                  {item.error && (
                    <div style={{ color: '#f85149', fontSize: 10, marginBottom: item.output ? 6 : 0, lineHeight: 1.5 }}>
                      {item.error}
                    </div>
                  )}
                  {item.output && (
                    <pre style={{
                      margin: 0, color: '#8b949e', fontSize: 10,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {item.output}
                    </pre>
                  )}
                </div>
              )}

              {/* Auto-expand failed items to show error */}
              {isFailed && expanded !== item.id && item.error && (
                <div style={{
                  padding: '2px 12px 4px 30px', fontSize: 10,
                  color: '#f85149', opacity: 0.7,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.error}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e',
  cursor: 'pointer', padding: '2px 4px', fontSize: 12,
  fontFamily: 'inherit', lineHeight: 1,
}
