import { useCallback, useRef, useState } from 'react'
import { PTYStart, PTYStop } from '../api'
import Terminal from './Terminal'

const MIN_HEIGHT = 120
const DEFAULT_HEIGHT = 320

export default function TerminalPane() {
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [fullscreen, setFullscreen] = useState(false)
  const [running, setRunning] = useState(false)
  const [dims, setDims] = useState({ cols: 80, rows: 24 })
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)

  const onReady = useCallback((d: { cols: number; rows: number }) => {
    setDims(d)
  }, [])

  const onResize = useCallback((cols: number, rows: number) => {
    setDims({ cols, rows })
  }, [])

  async function start() {
    await PTYStart(dims.cols, dims.rows)
    setRunning(true)
  }

  async function stop() {
    await PTYStop()
    setRunning(false)
  }

  // Drag-to-resize handle
  function onDragStart(e: React.MouseEvent) {
    e.preventDefault()
    dragStartY.current = e.clientY
    dragStartH.current = height

    function onMove(ev: MouseEvent) {
      const delta = dragStartY.current - ev.clientY
      setHeight(Math.max(MIN_HEIGHT, dragStartH.current + delta))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const paneStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', flexDirection: 'column',
        background: '#0d1117',
      }
    : {
        height,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid #21262d',
        background: '#0d1117',
      }

  return (
    <div style={paneStyle}>
      {/* Drag handle */}
      {!fullscreen && (
        <div
          onMouseDown={onDragStart}
          style={{
            height: 4, flexShrink: 0, cursor: 'row-resize',
            background: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#30363d')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        />
      )}

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px', height: 32, flexShrink: 0,
        borderBottom: '1px solid #21262d',
      }}>
        <span style={{ color: running ? '#3fb950' : '#8b949e', fontSize: 11 }}>
          {running ? '● running' : '○ idle'}
        </span>
        <span style={{ color: '#e6edf3', fontSize: 12, fontWeight: 600 }}>CLAUDE</span>
        <span style={{ color: '#484f58', fontSize: 11 }}>
          {dims.cols}×{dims.rows}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? 'exit fullscreen' : 'fullscreen'}
          style={statusBtn}
        >
          {fullscreen ? '⊡' : '⊞'}
        </button>
        {running ? (
          <button onClick={stop} style={{ ...statusBtn, color: '#f85149' }}>■ stop</button>
        ) : (
          <button onClick={start} style={{ ...statusBtn, color: '#3fb950' }}>▶ start</button>
        )}
      </div>

      {/* Terminal — no padding, FitAddon must measure exact available space */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Terminal onReady={onReady} onResize={onResize} />
      </div>
    </div>
  )
}

const statusBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e', fontSize: 12,
  cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit',
}
