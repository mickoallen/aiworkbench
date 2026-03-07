import { useEffect, useState } from 'react'
import './App.css'
import { store } from '../wailsjs/go/models'
import { ListProjects } from './api'
import ProjectPicker from './components/ProjectPicker'
import Canvas from './canvas/Canvas'
import TerminalPane from './terminal/TerminalPane'

export default function App() {
  const [projects, setProjects] = useState<store.Project[] | null>(null)
  const [activeProject, setActiveProject] = useState<store.Project | null>(null)

  useEffect(() => {
    ListProjects().then((ps) => {
      const list = ps ?? []
      setProjects(list)
      if (list.length === 1) setActiveProject(list[0])
    })
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
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
        <span style={{ color: '#484f58', fontSize: 12 }}>loading…</span>
      </div>
    )
  }

  if (!activeProject) {
    return <ProjectPicker existing={projects} onSelect={handleProjectSelected} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117', fontFamily: 'inherit' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
        height: 40, borderBottom: '1px solid #21262d', flexShrink: 0,
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
          onClick={() => setActiveProject(null)}
          style={{ background: 'transparent', border: 'none', color: '#484f58', fontSize: 11, cursor: 'pointer' }}
        >
          switch project
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Canvas projectId={activeProject.id} />
      </div>

      {/* Terminal — always visible, full width */}
      <TerminalPane />
    </div>
  )
}
