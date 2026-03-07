import { useState } from 'react'
import { store } from '../../wailsjs/go/models'
import { CreateProject, OpenDirDialog } from '../api'

interface Props {
  onSelect: (project: store.Project) => void
  existing: store.Project[]
}

export default function ProjectPicker({ onSelect, existing }: Props) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [creating, setCreating] = useState(existing.length === 0)

  async function pickDir() {
    const dir = await OpenDirDialog()
    if (dir) {
      setPath(dir)
      if (!name) setName(dir.split('/').pop() ?? '')
    }
  }

  async function create() {
    if (!name || !path) return
    const p = await CreateProject(name, path, '')
    onSelect(p)
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0d1117', fontFamily: 'inherit',
    }}>
      <div style={{ width: 400 }}>
        <h1 style={{ color: '#e6edf3', fontSize: 18, fontWeight: 600, marginBottom: 24 }}>aiworkbench</h1>

        {!creating && existing.length > 0 && (
          <>
            <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 8 }}>recent projects</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {existing.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p)}
                  style={{
                    background: '#161b22', border: '1px solid #30363d', borderRadius: 4,
                    padding: '10px 12px', color: '#e6edf3', fontSize: 13, textAlign: 'left',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: '#8b949e', fontSize: 11 }}>{p.path}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setCreating(true)}
              style={{
                background: 'transparent', border: '1px solid #30363d', borderRadius: 4,
                padding: '8px 12px', color: '#8b949e', fontSize: 12, cursor: 'pointer', width: '100%',
              }}
            >
              + new project
            </button>
          </>
        )}

        {creating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 4 }}>new project</div>

            <button
              onClick={pickDir}
              style={{
                background: '#161b22', border: '1px solid #30363d', borderRadius: 4,
                padding: '10px 12px', color: path ? '#e6edf3' : '#8b949e', fontSize: 12,
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              {path || 'select directory…'}
            </button>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="project name"
              style={{
                background: '#161b22', border: '1px solid #30363d', borderRadius: 4,
                padding: '10px 12px', color: '#e6edf3', fontSize: 13, outline: 'none',
                fontFamily: 'inherit',
              }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              {existing.length > 0 && (
                <button
                  onClick={() => setCreating(false)}
                  style={{
                    flex: 1, background: 'transparent', border: '1px solid #30363d', borderRadius: 4,
                    padding: '9px 12px', color: '#8b949e', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  cancel
                </button>
              )}
              <button
                onClick={create}
                disabled={!name || !path}
                style={{
                  flex: 2, background: name && path ? '#1f6feb' : '#21262d',
                  border: 'none', borderRadius: 4, padding: '9px 12px',
                  color: name && path ? '#fff' : '#484f58', fontSize: 13,
                  cursor: name && path ? 'pointer' : 'default', fontFamily: 'inherit',
                }}
              >
                create project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
