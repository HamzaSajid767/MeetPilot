import { useEffect, useState } from 'react'

export type ThemePreference = 'dark' | 'light'

export interface UiPreferences {
  readonly theme: ThemePreference
  readonly reduceMotion: boolean
  readonly developerMode: boolean
}

const STORAGE_KEY = 'zoom-dialer.ui-preferences'

const DEFAULTS: UiPreferences = {
  theme: 'dark',
  reduceMotion: false,
  developerMode: false
}

function readPreferences(): UiPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULTS
    }
    const parsed = JSON.parse(raw) as Partial<UiPreferences>
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      reduceMotion: Boolean(parsed.reduceMotion),
      developerMode: Boolean(parsed.developerMode)
    }
  } catch {
    return DEFAULTS
  }
}

function applyDomPreferences(prefs: UiPreferences): void {
  document.documentElement.dataset.theme = prefs.theme
  document.documentElement.dataset.reduceMotion = prefs.reduceMotion ? 'true' : 'false'
}

export function useUiPreferences() {
  const [preferences, setPreferences] = useState<UiPreferences>(() => {
    const initial = readPreferences()
    applyDomPreferences(initial)
    return initial
  })

  useEffect(() => {
    applyDomPreferences(preferences)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  function update(patch: Partial<UiPreferences>): void {
    setPreferences((current) => ({ ...current, ...patch }))
  }

  return { preferences, update }
}
