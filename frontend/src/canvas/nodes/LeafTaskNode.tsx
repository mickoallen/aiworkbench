import { Handle, Position, NodeProps } from '@xyflow/react'

const statusLabel: Record<string, string> = {
  planning: '[planning]',
  ready:    '[ready]',
  queued:   '[queued]',
  running:  '[running]',
  done:     '[done]',
  failed:   '[failed]',
}

const statusColor: Record<string, string> = {
  planning: '#8b949e',
  ready:    '#58a6ff',
  queued:   '#d29922',
  running:  '#3fb950',
  done:     '#8b949e',
  failed:   '#f85149',
}

export default function LeafTaskNode({ data, selected }: NodeProps) {
  const task = (data as any).task

  return (
    <div
      style={{
        background: '#161b22',
        border: `1px solid ${selected ? '#58a6ff' : '#30363d'}`,
        borderRadius: 4,
        padding: '10px 12px',
        width: 280,
        fontFamily: '"Menlo", "Monaco", monospace',
        cursor: 'default',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#30363d', border: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: statusColor[task.status] ?? '#8b949e', fontSize: 11, whiteSpace: 'nowrap' }}>
          {statusLabel[task.status] ?? `[${task.status}]`}
        </span>
        <span style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.name}
        </span>
      </div>
      {task.objective && (
        <div style={{ color: '#8b949e', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.objective}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: '#30363d', border: 'none' }} />
    </div>
  )
}
