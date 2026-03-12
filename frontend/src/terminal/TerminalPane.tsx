import { useCallback, useEffect, useRef, useState } from 'react'
import Terminal from './Terminal'
import { PTYStartInProject, PTYStop, PTYRunning } from '../api'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { useSettings } from '../components/SettingsContext'

interface Props {
  projectPath: string
  height: number
  onHeightChange: (h: number) => void
}

export default function TerminalPane({ projectPath, height, onHeightChange }: Props) {
  const { settings } = useSettings()
  const [status, setStatus] = useState<'idle' | 'running' | 'exited'>('idle')
  const [dims, setDims] = useState<{ cols: number; rows: number } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [agent, setAgent] = useState(settings.default_agent || 'claude')
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  // Listen for pty:exit
  useEffect(() => {
    const unsub = EventsOn('pty:exit', () => setStatus('exited'))
    return unsub
  }, [])

  // Check if already running on mount
  useEffect(() => {
    PTYRunning().then((r) => { if (r) setStatus('running') })
  }, [])

  const handleReady = useCallback((d: { cols: number; rows: number }) => {
    setDims(d)
    // Check if already running (e.g. after re-mount)
    PTYRunning().then((running) => {
      if (running) setStatus('running')
    })
  }, [projectPath, agent])

  const handleResize = useCallback((cols: number, rows: number) => {
    setDims({ cols, rows })
  }, [])

  function handleStart() {
    if (!dims) return
    PTYStartInProject(projectPath, dims.cols, dims.rows, agent, settings.architect_system_prompt).then(() => setStatus('running'))
  }

  function handleStop() {
    PTYStop()
    setStatus('exited')
  }

  // Drag to resize
  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      onHeightChange(Math.max(150, dragRef.current.startH + delta))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const paneHeight = fullscreen ? '100vh' : height
  const statusColor = status === 'running' ? '#3fb950' : status === 'exited' ? '#f85149' : '#8b949e'

  return (
    <div style={{
      height: paneHeight,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderTop: '1px solid #21262d',
      background: '#0d1117',
      position: fullscreen ? 'fixed' : 'relative',
      inset: fullscreen ? 0 : undefined,
      zIndex: fullscreen ? 100 : undefined,
    }}>
      {/* Drag handle */}
      {!fullscreen && (
        <div
          onMouseDown={handleDragStart}
          style={{
            height: 4, cursor: 'row-resize', flexShrink: 0,
            background: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#30363d')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        />
      )}

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 32, flexShrink: 0,
        borderBottom: '1px solid #21262d',
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: statusColor, flexShrink: 0,
        }} />
        <span style={{ color: '#8b949e', fontSize: 11 }}>terminal</span>

        {status !== 'running' && (
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            style={{
              background: '#0d1117', border: '1px solid #30363d', borderRadius: 3,
              color: '#8b949e', fontSize: 11, padding: '1px 4px', fontFamily: 'inherit',
            }}
          >
            <option value="claude">claude</option>
            <option value="opencode">opencode</option>
          </select>
        )}

        {(status === 'idle' || status === 'exited') && (
          <button onClick={handleStart} style={tbBtn}>
            {status === 'exited' ? '↻ restart' : '▶ start'}
          </button>
        )}
        {status === 'running' && (
          <button onClick={handleStop} style={tbBtn}>■ stop</button>
        )}

        <div style={{ flex: 1 }} />
        {dims && (
          <span style={{ color: '#484f58', fontSize: 10 }}>{dims.cols}×{dims.rows}</span>
        )}
        <button
          onClick={() => setFullscreen((f) => !f)}
          style={tbBtn}
        >
          {fullscreen ? '⊡' : '⊞'}
        </button>
      </div>

      {/* Terminal */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Terminal onReady={handleReady} onResize={handleResize} />
      </div>
    </div>
  )
}

const tbBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #30363d', borderRadius: 3,
  color: '#8b949e', fontSize: 11, cursor: 'pointer', padding: '1px 8px',
  fontFamily: 'inherit',
}
