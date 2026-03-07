import { useCallback, useEffect, useState } from 'react'
import { store } from '../../wailsjs/go/models'
import { ListQueue, ListTasks, RemoveFromQueueCascade, RunnerStart, RunnerStop, RunnerStatus } from '../api'
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
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [q, t, r] = await Promise.all([
      ListQueue(projectId),
      ListTasks(projectId),
      RunnerStatus(projectId),
    ])
    setItems(q ?? [])
    setTasks(t ?? [])
    setRunning(r)
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
    setRunning(!running)
  }

  async function remove(id: number) {
    await RemoveFromQueueCascade(id)
    load()
  }

  function taskName(item: store.QueueItem): string {
    if (item.task_id) {
      const t = tasks.find((t) => t.id === item.task_id)
      return t ? t.name : `task #${item.task_id}`
    }
    if (item.subtask_id) return `subtask #${item.subtask_id}`
    return `item #${item.id}`
  }

  const pending = items.filter((i) => i.status === 'pending').length
  const hasActive = items.some((i) => i.status === 'running')

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
            color: running ? '#f85149' : '#3fb950',
          }}
        >
          {running ? '■' : '▶'}
        </button>
      </div>

      {/* Runner status */}
      <div style={{
        padding: '4px 12px', fontSize: 10,
        color: hasActive ? '#f0883e' : (running ? '#3fb950' : '#484f58'),
        borderBottom: '1px solid #21262d',
      }}>
        {hasActive ? 'running task…' : (running ? 'waiting for tasks' : 'runner stopped')}
      </div>

      {/* Queue list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {items.length === 0 && (
          <div style={{ color: '#484f58', fontSize: 11, padding: '12px 14px' }}>
            no items in queue
          </div>
        )}
        {items.map((item) => (
          <div key={item.id}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', cursor: 'pointer',
                background: expanded === item.id ? '#161b22' : 'transparent',
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
              {(item.status === 'pending' || item.status === 'done' || item.status === 'failed') && (
                <button
                  onClick={(e) => { e.stopPropagation(); remove(item.id) }}
                  title="remove"
                  style={{ ...iconBtn, fontSize: 13, color: '#484f58' }}
                >×</button>
              )}
            </div>

            {/* Expanded output */}
            {expanded === item.id && (item.output || item.error) && (
              <div style={{
                margin: '0 8px 6px',
                background: '#161b22',
                border: '1px solid #21262d',
                borderRadius: 4,
                padding: '8px 10px',
                maxHeight: 220,
                overflowY: 'auto',
              }}>
                {item.error && (
                  <div style={{ color: '#f85149', fontSize: 10, marginBottom: 6 }}>
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
          </div>
        ))}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e',
  cursor: 'pointer', padding: '2px 4px', fontSize: 12,
  fontFamily: 'inherit', lineHeight: 1,
}
