import { useState } from 'react'
import { OpenTerminal } from '../api'

interface Props {
  projectPath: string
}

export default function TerminalPane({ projectPath }: Props) {
  const [launching, setLaunching] = useState(false)

  async function launch() {
    setLaunching(true)
    try {
      await OpenTerminal(projectPath)
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div style={{
      height: 52, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px',
      borderTop: '1px solid #21262d',
      background: '#0d1117',
    }}>
      <span style={{ color: '#484f58', fontSize: 11 }}>terminal</span>
      <button
        onClick={launch}
        disabled={launching}
        style={{
          background: '#1f6feb', border: 'none', borderRadius: 4,
          padding: '6px 14px', color: '#fff', fontSize: 12,
          cursor: launching ? 'default' : 'pointer',
          opacity: launching ? 0.6 : 1,
          fontFamily: 'inherit',
        }}
      >
        {launching ? 'opening…' : '▶ open claude in terminal'}
      </button>
      <span style={{ color: '#484f58', fontSize: 11 }}>{projectPath}</span>
    </div>
  )
}
