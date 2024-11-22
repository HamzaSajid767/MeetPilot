import { useEffect, useMemo, useRef, useState } from 'react'
import { filterPhrases } from '../../../shared/phrase'
import {
  buildShortcutMap,
  parseShortcutMap,
  planShortcutMapApply
} from '../../../shared/shortcut'
import type { DesktopController } from '../hooks/useDesktopController'
import { readHashPhraseId } from '../lib/navigation'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { SearchField } from '../components/ui/Field'
import { ConfirmDialog } from '../components/hotkeys/ConflictDialog'
import {
  filterHotkeyPhrases,
  HotkeyPhraseList,
  type HotkeyFilter
} from '../components/hotkeys/HotkeyPhraseList'
import { ShortcutEditor } from '../components/hotkeys/ShortcutEditor'

const FILTERS: { id: HotkeyFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'disabled', label: 'Disabled' }
]

export function HotkeysPage({
  controller,
  initialPhraseId,
  onPhraseFocusConsumed
}: {
  readonly controller: DesktopController
  readonly initialPhraseId?: string | null
  readonly onPhraseFocusConsumed?: () => void
}) {
  const { status, actions } = controller
  const phrases = useMemo(() => filterPhrases(status.phrases), [status.phrases])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<HotkeyFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialPhraseId && phrases.some((phrase) => phrase.id === initialPhraseId)) {
      setSelectedId(initialPhraseId)
      setRecording(true)
      onPhraseFocusConsumed?.()
    }
  }, [initialPhraseId, phrases, onPhraseFocusConsumed])

  useEffect(() => {
    const fromHash = readHashPhraseId()
    if (fromHash && phrases.some((phrase) => phrase.id === fromHash) && !selectedId) {
      setSelectedId(fromHash)
    }
  }, [phrases, selectedId])

  const visible = useMemo(
    () => filterHotkeyPhrases(phrases, status.hotkeyBindings, search, filter),
    [phrases, status.hotkeyBindings, search, filter]
  )

  const selected = phrases.find((phrase) => phrase.id === selectedId) ?? null

  async function exportMap(): Promise<void> {
    const doc = buildShortcutMap(phrases)
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'zoom-dialer-shortcuts.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importMap(file: File): Promise<void> {
    const text = await file.text()
    const parsed = parseShortcutMap(JSON.parse(text) as unknown)
    const plan = planShortcutMapApply(phrases, parsed, 'replace')
    for (const step of plan.assign) {
      await actions.setShortcut(step.phraseId, step.shortcut)
    }
  }

  async function clearAll(): Promise<void> {
    for (const phrase of phrases) {
      if (phrase.shortcut) {
        await actions.setShortcut(phrase.id, null)
      }
    }
  }

  return (
    <div className="stack stack--lg">
      <PageHeader
        title="Hotkeys"
        description="Design shortcuts on a visual keyboard — type them or click the keys."
        actions={
          <>
            <Button variant="secondary" onClick={() => void exportMap()}>
              Export map
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Import map
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClearAll(true)}>
              Clear all
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClearAll(true)}>
              Reset defaults
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Import shortcut map"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) {
            void importMap(file)
          }
        }}
      />

      <div className="card stack">
        <div className="hotkey-filter-bar">
          <div style={{ flex: 1, minWidth: '12rem' }}>
            <SearchField
              id="hotkey-search"
              value={search}
              onChange={setSearch}
              placeholder="Search phrases or shortcuts"
            />
          </div>
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="hotkey-filter-chip"
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <HotkeyPhraseList
          phrases={visible}
          bindings={status.hotkeyBindings}
          playingPhraseId={status.playingPhraseId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAssign={(phraseId) => {
            setSelectedId(phraseId)
            setRecording(true)
          }}
          onClear={(phraseId) => void actions.setShortcut(phraseId, null)}
        />
      </div>

      <div className="card stack">
        <h2 className="card__title">Shortcut designer</h2>
        <ShortcutEditor
          phrase={selected}
          phrases={phrases}
          recording={recording}
          onRecordingChange={setRecording}
          onAssign={async (phraseId, shortcut) => {
            await actions.setShortcut(phraseId, shortcut)
          }}
          onClearPhrase={async (phraseId) => {
            await actions.setShortcut(phraseId, null)
          }}
          onSelectPhrase={setSelectedId}
        />
      </div>

      <ConfirmDialog
        open={confirmClearAll}
        title="Clear all shortcuts?"
        description="This removes every phrase shortcut. Playback hotkeys will stop until you assign new ones."
        confirmLabel="Clear all"
        danger
        onCancel={() => setConfirmClearAll(false)}
        onConfirm={() => {
          setConfirmClearAll(false)
          void clearAll()
        }}
      />
    </div>
  )
}
