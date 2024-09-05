import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { StatusBar } from './components/layout/StatusBar'
import { ToastHost } from './components/ui/Toast'
import { useDesktopController } from './hooks/useDesktopController'
import { useToasts } from './hooks/useToasts'
import { useUiPreferences } from './hooks/useUiPreferences'
import {
  NAV_ITEMS,
  parseHash,
  writeHashView,
  type NavView
} from './lib/navigation'
import { DashboardPage } from './pages/DashboardPage'
import { DevicesPage } from './pages/DevicesPage'
import { HotkeysPage } from './pages/HotkeysPage'
import { PlaybackPage } from './pages/PlaybackPage'
import { ProjectPage } from './pages/ProjectPage'
import { RecordPage } from './pages/RecordPage'
import { SettingsPage } from './pages/SettingsPage'
import { SoundboardPage } from './pages/SoundboardPage'
import { TtsPage } from './pages/TtsPage'

export function App() {
  const { toasts, push, dismiss } = useToasts()
  const { preferences, update } = useUiPreferences()
  const controller = useDesktopController(push)
  const initial = parseHash()
  const [activeView, setActiveView] = useState<NavView>(initial.view)
  const [focusPhraseId, setFocusPhraseId] = useState<string | null>(initial.phraseId)

  useEffect(() => {
    const onHashChange = () => {
      const next = parseHash()
      setActiveView(next.view)
      setFocusPhraseId(next.phraseId)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((view: NavView, phraseId?: string | null) => {
    setActiveView(view)
    setFocusPhraseId(phraseId ?? null)
    writeHashView(view, phraseId)
  }, [])

  const clearPhraseFocus = useCallback(() => {
    setFocusPhraseId(null)
    writeHashView(activeView, null)
  }, [activeView])

  const pageKey = activeView

  return (
    <div className="app-frame">
      <Sidebar activeView={activeView} onNavigate={(view) => navigate(view)} />
      <main className="app-main" aria-label={NAV_ITEMS.find((item) => item.id === activeView)?.label}>
        <div className="app-main__inner" key={pageKey}>
          {activeView === 'dashboard' ? (
            <DashboardPage controller={controller} onNavigate={navigate} />
          ) : null}
          {activeView === 'soundboard' ? (
            <SoundboardPage controller={controller} onNavigate={navigate} />
          ) : null}
          {activeView === 'record' ? <RecordPage controller={controller} /> : null}
          {activeView === 'tts' ? <TtsPage controller={controller} /> : null}
          {activeView === 'hotkeys' ? (
            <HotkeysPage
              controller={controller}
              initialPhraseId={focusPhraseId}
              onPhraseFocusConsumed={clearPhraseFocus}
            />
          ) : null}
          {activeView === 'devices' ? <DevicesPage controller={controller} /> : null}
          {activeView === 'playback' ? (
            <PlaybackPage controller={controller} developerMode={preferences.developerMode} />
          ) : null}
          {activeView === 'project' ? <ProjectPage controller={controller} /> : null}
          {activeView === 'settings' ? (
            <SettingsPage
              preferences={preferences}
              onUpdatePreferences={update}
              controller={controller}
              apiVersion={controller.apiVersion}
            />
          ) : null}
        </div>
      </main>
      <StatusBar
        status={controller.status}
        progressPercent={controller.progressPercent}
        busy={controller.busy}
        connected={controller.connected}
        onStop={() => void controller.actions.stopPlayback()}
      />
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
