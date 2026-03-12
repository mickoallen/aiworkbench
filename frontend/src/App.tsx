import { useEffect, useState, useRef } from 'react'
import './App.css'
import { store } from '../wailsjs/go/models'
import { ListProjects, SetWindowTitle } from './api'
import ProjectPicker from './components/ProjectPicker'
import Canvas from './canvas/Canvas'
import TerminalPane from './terminal/TerminalPane'
import QueuePanel from './components/QueuePanel'
import SettingsModal from './components/SettingsModal'
import { ToastProvider } from './components/Toast'
import { SettingsProvider } from './components/SettingsContext'

export default function App() {
  const [projects, setProjects] = useState<store.Project[] | null>(null)
  const [activeProject, setActiveProject] = useState<store.Project | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [terminalHeight, setTerminalHeight] = useState(300)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const modalOpenRef = useRef(false)

  // Track if any modal is open for Escape handling
  modalOpenRef.current = settingsOpen

  useEffect(() => {
    ListProjects().then((ps) => {
      const list = ps ?? []
      setProjects(list)
      if (list.length === 1) setActiveProject(list[0])
    })
  }, [])

  // Set window title when project changes
  useEffect(() => {
    if (activeProject) {
      SetWindowTitle(`aiworkbench — ${activeProject.name}`)
    } else {
      SetWindowTitle('aiworkbench')
    }
  }, [activeProject])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSettingsOpen(false)
        return
      }
      if (!e.metaKey) return
      switch (e.key) {
        case 'j':
          setQueueOpen((o) => !o)
          e.preventDefault()
          break
        case 't':
          setTerminalOpen((o) => !o)
          e.preventDefault()
          break
        case ',':
          setSettingsOpen((o) => !o)
          e.preventDefault()
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  function handleProjectSelected(p: store.Project) {
    setProjects((prev) => {
      if (!prev) return [p]
      return prev.find((x) => x.id === p.id) ? prev : [...prev, p]
    })
    setActiveProject(p)
  }

  if (projects === null) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: '#484f58', fontSize: 12 }}>loading…</span>
      </div>
    )
  }

  if (!activeProject) {
    return <ProjectPicker existing={projects} onSelect={handleProjectSelected} />
  }

  return (
    <SettingsProvider>
    <ToastProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', fontFamily: 'inherit' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
          height: 40, borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600 }}>{activeProject.name}</span>
          <span style={{ color: '#484f58', fontSize: 11 }}>{activeProject.path}</span>
          {activeProject.session_branch && (
            <span style={{
              color: '#8b949e', fontSize: 11, background: '#161b22',
              border: '1px solid #30363d', borderRadius: 3, padding: '1px 6px',
            }}>
              {activeProject.session_branch}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setTerminalOpen((o) => !o)}
            style={topBarBtn(terminalOpen)}
          >
            terminal
          </button>
          <button
            onClick={() => setQueueOpen((o) => !o)}
            style={topBarBtn(queueOpen)}
          >
            queue
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              background: 'transparent', border: '1px solid transparent',
              borderRadius: 3, color: '#8b949e', fontSize: 13,
              cursor: 'pointer', padding: '2px 6px',
            }}
            title="Settings (⌘,)"
          >
            ⚙
          </button>
          <button
            onClick={() => setActiveProject(null)}
            style={{ background: 'transparent', border: 'none', color: '#484f58', fontSize: 11, cursor: 'pointer' }}
          >
            switch project
          </button>
        </div>

        {/* Main area: canvas + optional queue panel */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Canvas projectId={activeProject.id} />
          </div>
          {queueOpen && <QueuePanel projectId={activeProject.id} />}
        </div>

        {/* Terminal pane */}
        {terminalOpen && (
          <TerminalPane
            projectPath={activeProject.path}
            height={terminalHeight}
            onHeightChange={setTerminalHeight}
          />
        )}

        {/* Settings modal */}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </div>
    </ToastProvider>
    </SettingsProvider>
  )
}

function topBarBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? '#161b22' : 'transparent',
    border: active ? '1px solid #30363d' : '1px solid transparent',
    borderRadius: 3,
    color: active ? '#e6edf3' : '#8b949e',
    fontSize: 11, cursor: 'pointer', padding: '2px 8px',
  }
}
