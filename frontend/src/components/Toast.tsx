import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export const useToast = () => useContext(ToastContext)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  const colors: Record<ToastType, string> = {
    success: '#3fb950',
    error: '#f85149',
    info: '#58a6ff',
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 200,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: '#161b22', border: `1px solid ${colors[t.type]}`,
            borderRadius: 6, padding: '8px 14px', color: '#e6edf3',
            fontSize: 12, maxWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
