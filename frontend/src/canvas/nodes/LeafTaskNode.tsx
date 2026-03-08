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
  const border    = selected ? '#58a6ff' : (borderColor[task.status] ?? '#21262d')
  const glow      = isRunning ? '0 0 8px #3fb95033' : isQueued ? '0 0 8px #d2992233' : 'none'

  return (
    <div style={{
      background: '#161b22',
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: '18px 18px 16px',
      width: 300,
      fontFamily: '"JetBrains Mono", "Menlo", monospace',
      cursor: 'default',
      boxShadow: glow,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#30363d', border: 'none' }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{
          background: statusBg[task.status] ?? '#21262d',
          color: statusColor[task.status] ?? '#8b949e',
          fontSize: 9, fontWeight: 600,
          padding: '3px 8px', borderRadius: 10,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {task.status}
        </span>

        {!isDone && (
          <button
            onClick={isQueued ? onDequeue : onQueue}
            title={isQueued ? 'remove from queue' : 'add to queue (with deps)'}
            style={{
              ...qBtn,
              borderColor: isQueued ? '#d2992244' : '#21262d',
              background: isQueued ? '#d2992211' : 'transparent',
              color: isQueued ? '#d29922' : '#6e7681',
            }}
          >
            {isQueued ? '− queue' : isRunning ? '⏳' : '+ queue'}
          </button>
        )}
      </div>

      {/* Task name */}
      <div style={{
        color: '#e6edf3', fontSize: 13, fontWeight: 600,
        lineHeight: 1.4, wordBreak: 'break-word',
      }}>
        {task.name}
      </div>

      {/* Prompt preview */}
      {task.prompt && (
        <div style={{
          color: '#484f58', fontSize: 11, lineHeight: 1.5,
          marginTop: 10,
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
  border: '1px solid #21262d',
  borderRadius: 6,
  fontSize: 10, fontWeight: 500,
  cursor: 'pointer',
  padding: '4px 9px',
  fontFamily: 'inherit',
  flexShrink: 0,
  lineHeight: 1,
  letterSpacing: '0.02em',
}
