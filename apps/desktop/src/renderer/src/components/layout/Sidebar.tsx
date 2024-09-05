import type { ReactNode } from 'react'
import type { NavView } from '../../lib/navigation'
import { NAV_ITEMS } from '../../lib/navigation'
import {
  IconDashboard,
  IconDevices,
  IconHotkeys,
  IconLogo,
  IconPlayback,
  IconProject,
  IconRecord,
  IconSettings,
  IconSoundboard,
  IconTts
} from '../ui/Icon'

const ICONS: Record<NavView, ReactNode> = {
  dashboard: <IconDashboard className="app-sidebar__nav-icon" />,
  soundboard: <IconSoundboard className="app-sidebar__nav-icon" />,
  record: <IconRecord className="app-sidebar__nav-icon" />,
  tts: <IconTts className="app-sidebar__nav-icon" />,
  hotkeys: <IconHotkeys className="app-sidebar__nav-icon" />,
  devices: <IconDevices className="app-sidebar__nav-icon" />,
  playback: <IconPlayback className="app-sidebar__nav-icon" />,
  project: <IconProject className="app-sidebar__nav-icon" />,
  settings: <IconSettings className="app-sidebar__nav-icon" />
}

export function Sidebar({
  activeView,
  onNavigate
}: {
  readonly activeView: NavView
  readonly onNavigate: (view: NavView) => void
}) {
  return (
    <aside className="app-sidebar" aria-label="Main navigation">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo">
          <IconLogo />
        </div>
        <div>
          <div className="app-sidebar__title">Zoom Dialer</div>
          <div className="app-sidebar__subtitle">Companion</div>
        </div>
      </div>
      <nav className="app-sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="app-sidebar__nav-item"
            aria-current={activeView === item.id ? 'page' : undefined}
            title={item.label}
            onClick={() => onNavigate(item.id)}
          >
            {ICONS[item.id]}
            <span className="app-sidebar__nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
