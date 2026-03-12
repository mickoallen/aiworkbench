import { useEffect, useState } from 'react'
import { GetSetting, SetSetting } from '../api'

interface Props {
  onClose: () => void
}

const models = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
]

const agents = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'opencode', label: 'opencode' },
]

export default function SettingsModal({ onClose }: Props) {
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-6')
  const [defaultAgent, setDefaultAgent] = useState('claude')

  useEffect(() => {
    GetSetting('default_model').then((v: string) => { if (v) setDefaultModel(v) })
    GetSetting('default_agent').then((v: string) => { if (v) setDefaultAgent(v) })
  }, [])

  function handleModelChange(model: string) {
    setDefaultModel(model)
    SetSetting('default_model', model)
  }

  function handleAgentChange(agent: string) {
    setDefaultAgent(agent)
    SetSetting('default_agent', agent)
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600 }}>Settings</span>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        <label style={labelStyle}>Default Agent</label>
        <select
          value={defaultAgent}
          onChange={(e) => handleAgentChange(e.target.value)}
          style={{ ...selectStyle, marginBottom: 12 }}
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>

        <label style={labelStyle}>Default Model</label>
        <select
          value={defaultModel}
          onChange={(e) => handleModelChange(e.target.value)}
          style={selectStyle}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}

const modal: React.CSSProperties = {
  background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
  padding: 24, width: 380, fontFamily: 'inherit',
}

const closeBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#8b949e',
  fontSize: 18, cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 4,
}

const selectStyle: React.CSSProperties = {
  background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
  color: '#e6edf3', fontSize: 12, padding: '6px 8px', width: '100%',
  fontFamily: 'inherit',
}
