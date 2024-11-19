import { useEffect } from 'react'
import type { ChordState } from '../../../../shared/shortcut'
import {
  chordToAccelerator,
  describeShortcutError,
  emptyChord,
  eventToChord,
  isAllowedShortcut,
  normalizeShortcut
} from '../../../../shared/shortcut'
import { Button } from '../ui/Button'
import { ShortcutBadge } from './ShortcutBadge'

export function ShortcutRecorder({
  active,
  chord,
  phraseName,
  error,
  onChordChange,
  onConfirm,
  onCancel,
  onClear
}: {
  readonly active: boolean
  readonly chord: ChordState
  readonly phraseName: string
  readonly error: string | null
  readonly onChordChange: (chord: ChordState) => void
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly onClear: () => void
}) {
  useEffect(() => {
    if (!active) {
      return
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.repeat) {
        return
      }
      // Allow Escape to cancel without capturing
      if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        event.preventDefault()
        onCancel()
        return
      }
      event.preventDefault()
      event.stopPropagation()
      onChordChange(eventToChord(event))
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active, onCancel, onChordChange])

  if (!active) {
    return null
  }

  const live = chordToAccelerator(chord)
  const normalized = live ? normalizeShortcut(live) : null
  const valid = normalized != null && isAllowedShortcut(normalized)
  const hint = error ?? (normalized && !valid ? describeShortcutError(normalized) : null)

  return (
    <div className="shortcut-recorder card" role="status" aria-live="polite">
      <div className="stack stack--sm">
        <strong>Assign shortcut for {phraseName}</strong>
        <p className="card__meta">Press the desired key combination, or click keys on the keyboard…</p>
        <div className="row">
          <ShortcutBadge shortcut={normalized} tone={valid ? 'accent' : 'warning'} />
          {hint ? <span className="error-text">{hint}</span> : null}
        </div>
        <div className="row">
          <Button variant="primary" disabled={!valid} onClick={onConfirm}>
            Confirm
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onChordChange(emptyChord())
              onClear()
            }}
          >
            Clear
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
