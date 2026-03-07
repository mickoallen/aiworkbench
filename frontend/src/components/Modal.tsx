import { ReactNode, useEffect } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}

export default function Modal({ title, onClose, children, width = 480 }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, fontFamily: 'inherit',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
          width, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#8b949e', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#484f58', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ color: '#8b949e', fontSize: 11 }}>{label}</label>
      {children}
    </div>
  )
}

export function Input({ value, onChange, placeholder, multiline, rows }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
}) {
  const style = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
    padding: '8px 10px', color: '#e6edf3', fontSize: 12, outline: 'none',
    fontFamily: 'inherit', resize: 'vertical' as const, width: '100%', boxSizing: 'border-box' as const,
  }
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows ?? 4} style={style} />
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={style} />
}

export function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
          padding: '8px 32px 8px 10px', color: '#e6edf3', fontSize: 12, outline: 'none',
          fontFamily: 'inherit', width: '100%', cursor: 'pointer',
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        color: '#8b949e', fontSize: 10, pointerEvents: 'none', lineHeight: 1,
      }}>▾</span>
    </div>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 8 }}>{children}</div>
}

export function Btn({ onClick, danger, disabled, children }: {
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '8px 12px', borderRadius: 4, fontSize: 12,
        border: danger ? '1px solid #f85149' : 'none',
        background: danger ? 'transparent' : (disabled ? '#21262d' : '#1f6feb'),
        color: danger ? '#f85149' : (disabled ? '#484f58' : '#fff'),
        cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}
