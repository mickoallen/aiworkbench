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
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, fontFamily: 'inherit',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
          width, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          maxHeight: '85vh', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            color: '#6e7681', fontSize: 10, textTransform: 'uppercase',
            letterSpacing: '0.1em', fontWeight: 600,
          }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#484f58',
              fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
              borderRadius: 4,
            }}
          >×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ color: '#6e7681', fontSize: 11, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

export function Input({ value, onChange, placeholder, multiline, rows, disabled }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
  disabled?: boolean
}) {
  const style = {
    background: '#0d1117', border: '1px solid #21262d', borderRadius: 6,
    padding: '10px 12px', color: disabled ? '#484f58' : '#e6edf3', fontSize: 12, outline: 'none',
    fontFamily: 'inherit', resize: 'vertical' as const, width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
    cursor: disabled ? 'default' : undefined,
  }
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows ?? 4} style={style} disabled={disabled} />
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={style} disabled={disabled} />
}

export function Select({ value, onChange, options, disabled }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          background: '#0d1117', border: '1px solid #21262d', borderRadius: 6,
          padding: '10px 32px 10px 12px', color: disabled ? '#484f58' : '#e6edf3', fontSize: 12, outline: 'none',
          fontFamily: 'inherit', width: '100%', cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        color: '#484f58', fontSize: 10, pointerEvents: 'none', lineHeight: 1,
      }}>▾</span>
    </div>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>{children}</div>
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
        flex: 1, padding: '10px 14px', borderRadius: 6, fontSize: 12,
        fontWeight: 500,
        border: danger ? '1px solid #f8514933' : '1px solid transparent',
        background: danger ? 'transparent' : (disabled ? '#21262d' : '#1f6feb'),
        color: danger ? '#f85149' : (disabled ? '#484f58' : '#fff'),
        cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}
