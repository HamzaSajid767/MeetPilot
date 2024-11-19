import { useCallback, useMemo, useState } from 'react'
import type { Phrase } from '../../../../shared/phrase'
import { findShortcutConflict } from '../../../../shared/phrase'
import {
  chordToAccelerator,
  emptyChord,
  isAllowedShortcut,
  isModifierToken,
  normalizeShortcut,
  setPrimaryKey,
  toggleModifier,
  type ChordState,
  type ModifierToken
} from '../../../../shared/shortcut'
import { Keyboard } from './Keyboard'
import { ConflictDialog } from './ConflictDialog'
import { ShortcutRecorder } from './ShortcutRecorder'
import type { KeyboardKeyDef } from './keyboardLayout'

export function ShortcutEditor({
  phrase,
  phrases,
  recording,
  onRecordingChange,
  onAssign,
  onClearPhrase,
  onSelectPhrase
}: {
  readonly phrase: Phrase | null
  readonly phrases: readonly Phrase[]
  readonly recording: boolean
  readonly onRecordingChange: (active: boolean) => void
  readonly onAssign: (phraseId: string, shortcut: string) => Promise<void>
  readonly onClearPhrase: (phraseId: string) => Promise<void>
  readonly onSelectPhrase: (phraseId: string) => void
}) {
  const [chord, setChord] = useState<ChordState>(emptyChord())
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{
    shortcut: string
    owner: Phrase
  } | null>(null)

  const assignedTokens = useMemo(() => {
    const tokens = new Set<string>()
    for (const entry of phrases) {
      if (!entry.shortcut || (phrase && entry.id === phrase.id)) {
        continue
      }
      for (const part of entry.shortcut.split('+')) {
        tokens.add(part)
      }
    }
    return tokens
  }, [phrases, phrase])

  const conflictTokens = useMemo(() => {
    const live = chordToAccelerator(chord)
    if (!live || !phrase) {
      return new Set<string>()
    }
    const owner = findShortcutConflict(phrases, live, phrase.id)
    if (!owner?.shortcut) {
      return new Set<string>()
    }
    return new Set(owner.shortcut.split('+'))
  }, [chord, phrase, phrases])

  const resetChord = useCallback(() => {
    setChord(emptyChord())
    setError(null)
  }, [])

  const tryCommit = useCallback(
    async (accelerator: string, replaceOwnerId?: string) => {
      if (!phrase) {
        return
      }
      const normalized = normalizeShortcut(accelerator)
      if (!isAllowedShortcut(normalized)) {
        setError('Unsupported shortcut.')
        return
      }
      const owner = findShortcutConflict(phrases, normalized, phrase.id)
      if (owner && owner.id !== replaceOwnerId) {
        setConflict({ shortcut: normalized, owner })
        return
      }
      try {
        if (replaceOwnerId) {
          await onClearPhrase(replaceOwnerId)
        }
        await onAssign(phrase.id, normalized)
        onRecordingChange(false)
        resetChord()
        setConflict(null)
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error))
        setConflict(null)
      }
    },
    [phrase, phrases, onAssign, onClearPhrase, onRecordingChange, resetChord]
  )

  const onKeyActivate = useCallback(
    (def: KeyboardKeyDef) => {
      if (!recording || !def.token) {
        return
      }
      setError(null)
      if (def.kind === 'modifier' && isModifierToken(def.token)) {
        setChord((current) => toggleModifier(current, def.token as ModifierToken))
        return
      }
      setChord((current) => setPrimaryKey(current, def.token!))
    },
    [recording]
  )

  const onConfirm = useCallback(() => {
    const live = chordToAccelerator(chord)
    if (!live) {
      setError('Shortcut cannot be empty.')
      return
    }
    void tryCommit(live)
  }, [chord, tryCommit])

  return (
    <div className="stack">
      <ShortcutRecorder
        active={recording && phrase != null}
        chord={chord}
        phraseName={phrase?.name ?? ''}
        error={error}
        onChordChange={setChord}
        onConfirm={onConfirm}
        onCancel={() => {
          onRecordingChange(false)
          resetChord()
        }}
        onClear={() => {
          if (phrase) {
            void onClearPhrase(phrase.id)
          }
          resetChord()
        }}
      />

      {!recording ? (
        <p className="card__meta">
          Select a phrase and click Assign shortcut, then type or click a combination.
        </p>
      ) : null}

      <Keyboard
        chord={chord}
        assignedTokens={assignedTokens}
        conflictTokens={conflictTokens}
        onKeyActivate={onKeyActivate}
      />

      <ConflictDialog
        open={conflict != null}
        shortcut={conflict?.shortcut ?? ''}
        ownerName={conflict?.owner.name ?? ''}
        onCancel={() => setConflict(null)}
        onReplace={() => {
          if (conflict) {
            void tryCommit(conflict.shortcut, conflict.owner.id)
          }
        }}
        onJump={() => {
          if (conflict) {
            onSelectPhrase(conflict.owner.id)
            setConflict(null)
            onRecordingChange(false)
            resetChord()
          }
        }}
      />
    </div>
  )
}
