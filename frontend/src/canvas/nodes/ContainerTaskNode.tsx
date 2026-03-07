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

  const depSources = new Set(subtaskDeps.map((d: any) => d.depends_on_id))
  const depTargets = new Set(subtaskDeps.map((d: any) => d.subtask_id))

  const anyRunning = subtasks.some((st: any) => st.status === 'running')
  const anyQueued  = subtasks.some((st: any) => st.status === 'queued')
  const outerBorder = selected ? '#58a6ff'
    : anyRunning ? '#3fb950'
    : anyQueued  ? '#d29922'
    : '#30363d'
  const glow = anyRunning ? '0 0 0 1px #3fb95066' : anyQueued ? '0 0 0 1px #d2992266' : 'none'

  return (
    <div style={{
      background: '#0d1117',
      border: `1.5px dashed ${outerBorder}`,
      borderRadius: 8,
      padding: '14px 12px 14px',
      width: 360,
      fontFamily: '"JetBrains Mono", "Menlo", monospace',
      cursor: 'default',
      boxShadow: glow,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#30363d', border: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#484f58', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
            container · {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}
          </div>
          <div style={{ color: '#e6edf3', fontSize: 14, fontWeight: 700, lineHeight: 1.3, wordBreak: 'break-word' }}>
            {task.name}
          </div>
        </div>
        <button
          onClick={anyQueued ? onDequeue : onQueue}
          title={anyQueued ? 'remove all from queue' : 'queue all subtasks (with deps)'}
          style={{
            ...qBtn,
            borderColor: anyQueued ? '#d29922' : '#30363d',
            color: anyQueued ? '#d29922' : '#8b949e',
            marginTop: 2,
          }}
        >
          {anyQueued ? '−Q all' : '+Q all'}
        </button>
      </div>

      {/* Subtask list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {subtasks.map((st: any, i: number) => {
          const isSource  = depSources.has(st.id)
          const isTarget  = depTargets.has(st.id)
          const showArrow = i > 0 && isTarget
          const isQueued  = st.status === 'queued'
          const isRunning = st.status === 'running'
          const isDone    = st.status === 'done'

          return (
            <div key={st.id}>
              {showArrow && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px' }}>
                  <div style={{ flex: 1, height: 1, background: '#21262d' }} />
                  <span style={{ margin: '0 6px', color: '#484f58', fontSize: 10 }}>↓</span>
                  <div style={{ flex: 1, height: 1, background: '#21262d' }} />
                </div>
              )}
              <div style={{
                background: isRunning ? '#0f2a1a' : isQueued ? '#1e1a0e' : '#161b22',
                border: `1px solid ${isRunning ? '#3fb950' : isQueued ? '#d29922' : (isSource || isTarget ? '#30363d' : '#21262d')}`,
                borderRadius: 5,
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  background: statusBg[st.status] ?? '#21262d',
                  color: statusColor[st.status] ?? '#6e7681',
                  fontSize: 9, fontWeight: 600,
                  padding: '2px 5px', borderRadius: 3,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  flexShrink: 0,
                }}>
                  {st.status}
                </span>
                <span style={{
                  color: '#c9d1d9', fontSize: 12, fontWeight: 500,
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {st.name}
                </span>
                {isSource && !isTarget && (
                  <span style={{ color: '#30363d', fontSize: 10, flexShrink: 0 }}>→</span>
                )}
                {!isDone && (
                  <button
                    onClick={(e) => isQueued ? onDequeueSubtask(e, st.id) : onQueueSubtask(e, st.id)}
                    title={isQueued ? 'remove from queue' : 'queue (with deps)'}
                    style={{
                      ...qBtn,
                      borderColor: isQueued ? '#d29922' : '#30363d',
                      color: isQueued ? '#d29922' : '#6e7681',
                      padding: '2px 5px',
                    }}
                  >
                    {isQueued ? '−Q' : isRunning ? '⏳' : '+Q'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {subtasks.length === 0 && (
          <div style={{ color: '#484f58', fontSize: 11, padding: '6px 2px' }}>no subtasks yet</div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#30363d', border: 'none' }} />
    </div>
  )
}

const qBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid #30363d',
  borderRadius: 4,
  fontSize: 10, fontWeight: 600,
  cursor: 'pointer',
  padding: '3px 7px',
  fontFamily: 'inherit',
  flexShrink: 0,
  lineHeight: 1,
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
}
