import { Handle, Position, NodeProps } from '@xyflow/react'

const statusColor: Record<string, string> = {
  planning: '#8b949e',
  ready:    '#58a6ff',
  queued:   '#d29922',
  running:  '#3fb950',
  done:     '#3fb950',
  failed:   '#f85149',
}

const statusBg: Record<string, string> = {
  planning: '#21262d',
  ready:    '#1c2d3f',
  queued:   '#2d1f07',
  running:  '#0f2a1a',
  done:     '#0f2a1a',
  failed:   '#2d0f0e',
}

const borderColor: Record<string, string> = {
  queued:  '#d29922',
  running: '#3fb950',
  failed:  '#f85149',
}

export default function LeafTaskNode({ data, selected }: NodeProps) {
  const task     = (data as any).task
  const onQueue  = (data as any).onQueue
  const onDequeue = (data as any).onDequeue

  const isQueued  = task.status === 'queued'
  const isRunning = task.status === 'running'
  const isDone    = task.status === 'done'
  const border    = selected ? '#58a6ff' : (borderColor[task.status] ?? '#30363d')
  const glow      = isRunning ? '0 0 0 1px #3fb95066' : isQueued ? '0 0 0 1px #d2992266' : 'none'

  return (
    <div style={{
      background: '#161b22',
      border: `1.5px solid ${border}`,
      borderRadius: 8,
      padding: '14px 14px 12px',
      width: 340,
      fontFamily: '"JetBrains Mono", "Menlo", monospace',
      cursor: 'default',
      boxShadow: glow,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#30363d', border: 'none' }} />

      {/* Header row: status badge + queue toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          background: statusBg[task.status] ?? '#21262d',
          color: statusColor[task.status] ?? '#8b949e',
          fontSize: 10, fontWeight: 600,
          padding: '2px 7px', borderRadius: 4,
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {task.status}
        </span>

        {!isDone && (
          <button
            onClick={isQueued ? onDequeue : onQueue}
            title={isQueued ? 'remove from queue' : 'add to queue (with deps)'}
            style={{
              ...qBtn,
              borderColor: isQueued ? '#d29922' : '#30363d',
              color: isQueued ? '#d29922' : '#8b949e',
            }}
          >
            {isQueued ? '−Q' : isRunning ? '⏳' : '+Q'}
          </button>
        )}
      </div>

      {/* Task name */}
      <div style={{
        color: '#e6edf3', fontSize: 14, fontWeight: 700,
        lineHeight: 1.35, marginBottom: task.prompt ? 8 : 0,
        wordBreak: 'break-word',
      }}>
        {task.name}
      </div>

      {/* Prompt preview */}
      {task.prompt && (
        <div style={{
          color: '#6e7681', fontSize: 11, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        } as React.CSSProperties}>
          {task.prompt}
        </div>
      )}

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
}
