import { Handle, Position, NodeProps } from '@xyflow/react'

const statusColor: Record<string, string> = {
  pending:  '#8b949e',
  ready:    '#58a6ff',
  queued:   '#d29922',
  running:  '#3fb950',
  done:     '#8b949e',
  failed:   '#f85149',
}

export default function ContainerTaskNode({ data, selected }: NodeProps) {
  const task = (data as any).task
  const subtasks: any[] = (data as any).subtasks ?? []

  return (
    <div
      style={{
        background: '#0d1117',
        border: `1px dashed ${selected ? '#58a6ff' : '#30363d'}`,
        borderRadius: 6,
        padding: '8px 10px 10px',
        width: 300,
        fontFamily: '"Menlo", "Monaco", monospace',
        cursor: 'default',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#30363d', border: 'none' }} />

      <div style={{ color: '#8b949e', fontSize: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        container · {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}
      </div>
      <div style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        {task.name}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {subtasks.map((st: any) => (
          <div
            key={st.id}
            style={{
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: 3,
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ color: statusColor[st.status] ?? '#8b949e', fontSize: 10, whiteSpace: 'nowrap' }}>
              [{st.status}]
            </span>
            <span style={{ color: '#c9d1d9', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {st.name}
            </span>
          </div>
        ))}
        {subtasks.length === 0 && (
          <div style={{ color: '#484f58', fontSize: 11, padding: '4px 0' }}>no subtasks</div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#30363d', border: 'none' }} />
    </div>
  )
}
