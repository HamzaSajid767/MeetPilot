export const NAV_VIEWS = [
  'dashboard',
  'soundboard',
  'record',
  'tts',
  'hotkeys',
  'devices',
  'playback',
  'project',
  'settings'
] as const

export type NavView = (typeof NAV_VIEWS)[number]

export interface NavItem {
  readonly id: NavView
  readonly label: string
  readonly description: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Status and quick play' },
  { id: 'soundboard', label: 'Soundboard', description: 'Browse and play phrases' },
  { id: 'record', label: 'Record', description: 'Capture a new phrase' },
  { id: 'tts', label: 'Text to Speech', description: 'Generate spoken phrases' },
  { id: 'hotkeys', label: 'Hotkeys', description: 'Assign keyboard shortcuts' },
  { id: 'devices', label: 'Audio Devices', description: 'Microphone and speaker' },
  { id: 'playback', label: 'Playback', description: 'Queue, gains, and meters' },
  { id: 'project', label: 'Project', description: 'Import, export, and reset' },
  { id: 'settings', label: 'Settings', description: 'Theme and preferences' }
]

export function isNavView(value: string): value is NavView {
  return (NAV_VIEWS as readonly string[]).includes(value)
}

export function parseHash(): { view: NavView; phraseId: string | null } {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = raw.split('?')
  const view: NavView = isNavView(pathPart ?? '') ? (pathPart as NavView) : 'dashboard'
  const params = new URLSearchParams(queryPart ?? '')
  const phraseId = params.get('phrase')
  return { view, phraseId: phraseId && phraseId.trim() ? phraseId : null }
}

export function readHashView(): NavView {
  return parseHash().view
}

export function readHashPhraseId(): string | null {
  return parseHash().phraseId
}

export function writeHashView(view: NavView, phraseId?: string | null): void {
  const next =
    phraseId && phraseId.trim()
      ? `#/${view}?phrase=${encodeURIComponent(phraseId)}`
      : `#/${view}`
  if (window.location.hash !== next) {
    window.location.hash = next
  }
}
