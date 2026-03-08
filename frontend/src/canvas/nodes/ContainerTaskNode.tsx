import { Handle, Position, NodeProps } from '@xyflow/react'

const statusColor: Record<string, string> = {
  pending: '#6e7681',
  queued:  '#d29922',
  running: '#3fb950',
  done:    '#3fb950',
  failed:  '#f85149',
}

const statusBg: Record<string, string> = {
  pending: '#21262d',
  queued:  '#2d1f07',
  running: '#0f2a1a',
  done:    '#0f2a1a',
  failed:  '#2d0f0e',
}

export default function ContainerTaskNode({ data, selected }: NodeProps) {
  const task            = (data as any).task
  const subtasks: any[] = (data as any).subtasks ?? []
  const subtaskDeps: any[] = (data as any).subtaskDeps ?? []
  const onQueue         = (data as any).onQueue
  const onDequeue       = (data as any).onDequeue
  const onQueueSubtask  = (data as any).onQueueSubtask
  const onDequeueSubtask = (data as any).onDequeueSubtask

  const depTargets = new Set(subtaskDeps.map((d: any) => d.subtask_id))

  const anyRunning = subtasks.some((st: any) => st.status === 'running')
  const anyQueued  = subtasks.some((st: any) => st.status === 'queued')
  const outerBorder = selected ? '#58a6ff'
    : anyRunning ? '#3fb950'
    : anyQueued  ? '#d29922'
    : '#21262d'
  const glow = anyRunning ? '0 0 8px #3fb95033' : anyQueued ? '0 0 8px #d2992233' : 'none'

  return (
    <div style={{
      background: '#0d1117',
      border: `1px dashed ${outerBorder}`,
      borderRadius: 10,
      padding: '18px 16px 16px',
      width: 320,
      fontFamily: '"JetBrains Mono", "Menlo", monospace',
      cursor: 'default',
      boxShadow: glow,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#30363d', border: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: '#484f58', fontSize: 9, textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 6,
          }}>
            {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}
          </div>
          <div style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word' }}>
            {task.name}
          </div>
        </div>
        <button
          onClick={anyQueued ? onDequeue : onQueue}
          title={anyQueued ? 'remove all from queue' : 'queue all subtasks (with deps)'}
          style={{
            ...qBtn,
            borderColor: anyQueued ? '#d2992244' : '#21262d',
            background: anyQueued ? '#d2992211' : 'transparent',
            color: anyQueued ? '#d29922' : '#6e7681',
            marginTop: 2,
          }}
        >
          {anyQueued ? '− all' : '+ all'}
        </button>
      </div>

      {/* Subtask list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {subtasks.map((st: any, i: number) => {
          const isTarget  = depTargets.has(st.id)
          const showArrow = i > 0 && isTarget
          const isQueued  = st.status === 'queued'
          const isRunning = st.status === 'running'
          const isDone    = st.status === 'done'

          return (
            <div key={st.id}>
              {showArrow && (
                <div style={{
                  display: 'flex', justifyContent: 'center',
                  padding: '1px 0', color: '#30363d', fontSize: 9,
                }}>
                  ↓
                </div>
              )}
              <div style={{
                background: isRunning ? '#0f2a1a' : isQueued ? '#1e1a0e' : '#161b22',
                border: `1px solid ${isRunning ? '#3fb95044' : isQueued ? '#d2992244' : '#21262d'}`,
                borderRadius: 6,
                padding: '7px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  background: statusBg[st.status] ?? '#21262d',
                  color: statusColor[st.status] ?? '#6e7681',
                  fontSize: 8, fontWeight: 600,
                  padding: '2px 6px', borderRadius: 8,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  flexShrink: 0,
                }}>
                  {st.status}
                </span>
                <span style={{
                  color: '#c9d1d9', fontSize: 11, fontWeight: 500,
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {st.name}
                </span>
                {!isDone && (
                  <button
                    onClick={(e) => isQueued ? onDequeueSubtask(e, st.id) : onQueueSubtask(e, st.id)}
                    title={isQueued ? 'remove from queue' : 'queue (with deps)'}
                    style={{
                      ...qBtnSmall,
                      color: isQueued ? '#d29922' : '#484f58',
                    }}
                  >
                    {isQueued ? '−' : isRunning ? '⏳' : '+'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {subtasks.length === 0 && (
          <div style={{ color: '#30363d', fontSize: 11, padding: '8px 4px', fontStyle: 'italic' }}>
            no subtasks
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#30363d', border: 'none' }} />
    </div>
  )
}

const qBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid #21262d',
  borderRadius: 6,
  fontSize: 10, fontWeight: 500,
  cursor: 'pointer',
  padding: '4px 9px',
  fontFamily: 'inherit',
  flexShrink: 0,
  lineHeight: 1,
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
}

const qBtnSmall: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 12, fontWeight: 600,
  cursor: 'pointer',
  padding: '0 2px',
  fontFamily: 'inherit',
  flexShrink: 0,
  lineHeight: 1,
}
