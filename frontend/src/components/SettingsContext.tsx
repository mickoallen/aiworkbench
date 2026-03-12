import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ListSettings, SetSetting } from '../api'
import { AppSettings, DEFAULT_SETTINGS, parseSettings } from '../settings'

interface SettingsContextType {
  settings: AppSettings
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
})

export const useSettings = () => useContext(SettingsContext)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    ListSettings().then((raw) => {
      const parsed = parseSettings(raw ?? {})
      setSettings(parsed)
      applyTheme(parsed.theme)
    })
  }, [])

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'theme') applyTheme(value as string)
      return next
    })
    SetSetting(key, value as string)
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  )
}

function applyTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme)
}
