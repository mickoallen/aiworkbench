import { Handle, Position, NodeProps } from '@xyflow/react'
import RunningBorder from './RunningBorder'

const statusColor: Record<string, string> = {
  planning: '#8b949e',
  ready:    '#58a6ff',
  queued:   '#d29922',
  running:  '#f0883e',
  done:     '#6e7681',
  failed:   '#f85149',
}

const statusBg: Record<string, string> = {
  planning: '#21262d',
  ready:    '#1c2d3f',
  queued:   '#2d1f07',
  running:  '#271a0a',
  done:     '#161b22',
  failed:   '#2d0f0e',
}

const accentColor: Record<string, string> = {
  ready:   '#1f6feb',
  queued:  '#d29922',
  running: '#f0883e',
  failed:  '#f85149',
}

export default function LeafTaskNode({ data, selected }: NodeProps) {
  const task      = (data as any).task
  const onQueue   = (data as any).onQueue
  const onDequeue = (data as any).onDequeue

  const isQueued  = task.status === 'queued'
  const isRunning = task.status === 'running'
  const isDone    = task.status === 'done'
  const accent    = accentColor[task.status]
  const glow      = isQueued ? '0 0 8px #d2992233' : 'none'

  const borderStyle: React.CSSProperties = selected
    ? { border: '1px solid #58a6ff' }
    : accent
      ? { border: '1px solid #21262d', borderLeft: `3px solid ${accent}` }
      : { border: '1px solid #21262d' }

  return (
    <div style={{
      position: 'relative',
      background: '#161b22',
      ...borderStyle,
      borderRadius: 10,
      padding: '18px 18px 16px',
      width: 300,
      fontFamily: '"JetBrains Mono", "Menlo", monospace',
      cursor: 'default',
      boxShadow: glow,
      animation: isRunning ? 'glow-pulse 2s ease-in-out infinite' : undefined,
    }}>
      {isRunning && <RunningBorder />}
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
        color: isDone ? '#6e7681' : '#e6edf3', fontSize: 13, fontWeight: 600,
        lineHeight: 1.4, wordBreak: 'break-word',
      }}>
        {task.name}
      </div>

      {/* Prompt preview */}
      {task.prompt && (
        <div style={{
          color: '#6e7681', fontSize: 11, lineHeight: 1.5,
          marginTop: 10,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        } as React.CSSProperties}>
          {task.prompt}
        </div>
      )}

      {/* Model / agent badges */}
      {(task.agent || task.model) && (
        <div style={{ display: 'flex', gap: 4, marginTop: 10, justifyContent: 'flex-end' }}>
          {task.agent && (
            <span style={{
              background: '#21262d', color: '#6e7681',
              fontSize: 9, padding: '2px 6px', borderRadius: 8,
              letterSpacing: '0.04em',
            }}>
              {task.agent}
            </span>
          )}
          {task.model && (
            <span style={{
              background: '#21262d', color: '#6e7681',
              fontSize: 9, padding: '2px 6px', borderRadius: 8,
              letterSpacing: '0.04em',
            }}>
              {task.model}
            </span>
          )}
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
