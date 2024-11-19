import type { HotkeyBindingStatus, Phrase } from '../../../../shared/phrase'
import { Badge } from '../ui/Meter'
import { Button } from '../ui/Button'
import { ShortcutBadge } from './ShortcutBadge'

export type HotkeyFilter = 'all' | 'assigned' | 'unassigned' | 'conflicts' | 'disabled'

export function HotkeyPhraseList({
  phrases,
  bindings,
  playingPhraseId,
  selectedId,
  onSelect,
  onAssign,
  onClear
}: {
  readonly phrases: readonly Phrase[]
  readonly bindings: readonly HotkeyBindingStatus[]
  readonly playingPhraseId: string | null
  readonly selectedId: string | null
  readonly onSelect: (phraseId: string) => void
  readonly onAssign: (phraseId: string) => void
  readonly onClear: (phraseId: string) => void
}) {
  if (phrases.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__title">No matching phrases</div>
        <p>Try a different search or filter.</p>
      </div>
    )
  }

  return (
    <ul className="hotkey-phrase-list">
      {phrases.map((phrase) => {
        const binding = bindings.find((entry) => entry.phraseId === phrase.id)
        const selected = selectedId === phrase.id
        const playing = playingPhraseId === phrase.id
        return (
          <li key={phrase.id}>
            <button
              type="button"
              className={`card hotkey-phrase-row${selected ? ' hotkey-phrase-row--selected' : ''}`}
              onClick={() => onSelect(phrase.id)}
              aria-current={selected ? 'true' : undefined}
            >
              <div className="row row--between" style={{ width: '100%' }}>
                <div className="stack stack--sm" style={{ textAlign: 'left' }}>
                  <strong>{phrase.name}</strong>
                  <span className="card__meta">{phrase.category ?? 'Uncategorized'}</span>
                </div>
                <div className="row">
                  {playing ? <Badge tone="accent">Playing</Badge> : null}
                  {!phrase.enabled ? <Badge tone="warning">Disabled</Badge> : null}
                  {binding?.registered ? (
                    <Badge tone="success">Registered</Badge>
                  ) : phrase.shortcut ? (
                    <Badge tone="warning">{binding?.error ?? 'Not registered'}</Badge>
                  ) : null}
                  <ShortcutBadge shortcut={phrase.shortcut} />
                </div>
              </div>
              <div className="row" style={{ marginTop: '0.75rem' }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={(event) => {
                    event.stopPropagation()
                    onAssign(phrase.id)
                  }}
                >
                  Assign shortcut
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!phrase.shortcut}
                  onClick={(event) => {
                    event.stopPropagation()
                    onClear(phrase.id)
                  }}
                >
                  Clear
                </Button>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function filterHotkeyPhrases(
  phrases: readonly Phrase[],
  bindings: readonly HotkeyBindingStatus[],
  search: string,
  filter: HotkeyFilter
): Phrase[] {
  const q = search.trim().toLowerCase()
  return phrases.filter((phrase) => {
    if (filter === 'assigned' && !phrase.shortcut) {
      return false
    }
    if (filter === 'unassigned' && phrase.shortcut) {
      return false
    }
    if (filter === 'disabled' && phrase.enabled) {
      return false
    }
    if (filter === 'conflicts') {
      const binding = bindings.find((entry) => entry.phraseId === phrase.id)
      if (!phrase.shortcut || binding?.registered !== false) {
        return false
      }
    }
    if (!q) {
      return true
    }
    return (
      phrase.name.toLowerCase().includes(q) ||
      (phrase.shortcut?.toLowerCase().includes(q) ?? false) ||
      (phrase.category?.toLowerCase().includes(q) ?? false)
    )
  })
}
