import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import '@xterm/xterm/css/xterm.css'
import { PTYWrite, PTYResize } from '../api'
import { EventsOn } from '../../wailsjs/runtime/runtime'

interface Props {
  onReady: (dims: { cols: number; rows: number }) => void
  onResize: (cols: number, rows: number) => void
}

export default function Terminal({ onReady, onResize }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const xterm = new XTerm({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        black: '#0d1117',
        brightBlack: '#8b949e',
        white: '#e6edf3',
        brightWhite: '#ffffff',
      },
      fontFamily: '"Menlo", "Monaco", monospace',
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
      macOptionIsMeta: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    const unicode11 = new Unicode11Addon()
    xterm.loadAddon(fitAddon)
    xterm.loadAddon(unicode11)
    xterm.open(container)
    xterm.unicode.activeVersion = '11'

    xtermRef.current = xterm
    fitRef.current = fitAddon

    // Apply dimensions with a safety margin so box-drawing lines never wrap.
    const safeFit = (): { cols: number; rows: number } | null => {
      const dim = fitAddon.proposeDimensions()
      if (!dim) return null
      const cols = Math.max(1, dim.cols - 2)
      const rows = Math.max(1, dim.rows)
      xterm.resize(cols, rows)
      return { cols, rows }
    }

    // Initial fit — wait for fonts so character width is measured correctly.
    document.fonts.ready.then(() => {
      const dim = safeFit()
      if (dim) onReady(dim)
    })

    // Key input → PTY
    xterm.onData((data) => PTYWrite(data))

    // PTY output → xterm
    const unsubData = EventsOn('pty:data', (data: string) => xterm.write(data))

    // PTY exit
    const unsubExit = EventsOn('pty:exit', () =>
      xterm.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n')
    )

    // Resize observer — only fires on actual user-driven layout changes (window
    // resize, pane drag). Debounced to avoid rapid-fire SIGWINCH to Claude Code.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let initialFired = false
    const observer = new ResizeObserver(() => {
      // Skip the very first callback (element attached to DOM) — handled by fonts.ready.
      if (!initialFired) { initialFired = true; return }

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!fitRef.current || !xtermRef.current) return
        const dim = safeFit()
        if (!dim) return
        PTYResize(dim.cols, dim.rows)
        onResize(dim.cols, dim.rows)
      }, 100)
    })
    observer.observe(container)

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      observer.disconnect()
      unsubData()
      unsubExit()
      xterm.dispose()
      xtermRef.current = null
      fitRef.current = null
    }
  }, [onReady, onResize])

  // Extra right padding so FitAddon never over-counts columns in a flex container.
  return <div ref={containerRef} style={{ width: '100%', height: '100%', paddingRight: 16 }} />
}
