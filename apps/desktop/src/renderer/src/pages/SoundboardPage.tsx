import { useMemo, useRef, useState } from 'react'
import { filterPhrases, uniqueCategories, type Phrase } from '../../../shared/phrase'
import type { DesktopController } from '../hooks/useDesktopController'
import { formatDuration } from '../lib/format'
import type { NavView } from '../lib/navigation'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { Field, SearchField, Select } from '../components/ui/Field'
import { IconPlay } from '../components/ui/Icon'
import { Badge, ProgressBar } from '../components/ui/Meter'
import { ShortcutBadge } from '../components/hotkeys/ShortcutBadge'

type DialogState =
  | { kind: 'rename'; phrase: Phrase }
  | { kind: 'category'; phrase: Phrase }
  | { kind: 'remove'; phrase: Phrase }
  | null

export function SoundboardPage({
  controller,
  onNavigate
}: {
  readonly controller: DesktopController
  readonly onNavigate: (view: NavView, phraseId?: string | null) => void
}) {
  const { status, busy, connected, categoryFilter, progressPercent, actions } = controller
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)

  const categories = useMemo(() => uniqueCategories(status.phrases), [status.phrases])
  const ordered = useMemo(() => filterPhrases(status.phrases), [status.phrases])
  const visiblePhrases = useMemo(
    () =>
      filterPhrases(status.phrases, {
        search,
        category: categoryFilter || null
      }),
    [status.phrases, search, categoryFilter]
  )

  return (
    <div className="stack stack--lg">
      <PageHeader
        title="Soundboard"
        description="Search your library and play phrases into the call."
        actions={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => void actions.importWavs()}>
              Import WAVs
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !connected}
              onClick={() => void actions.skip()}
            >
              Skip
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void actions.clearQueue()}>
              Clear queue
            </Button>
          </>
        }
      />

      <div className="card stack">
        <div className="row">
          <div style={{ flex: 1, minWidth: '12rem' }}>
            <SearchField
              id="phrase-search"
              value={search}
              onChange={setSearch}
              placeholder="Search phrases"
            />
          </div>
          <Field label="Category" htmlFor="phrase-category">
            <Select
              id="phrase-category"
              value={categoryFilter}
              onChange={(event) => void actions.setCategoryFilter(event.target.value)}
            >
              <option value="">All</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="row row--between">
          <div className="stack stack--sm">
            <strong>{status.playingPhraseName ?? 'Nothing playing'}</strong>
            <span className="card__meta">
              Next {status.nextPhraseName ?? '—'} · Queue {status.queueLength}
            </span>
          </div>
          <Badge tone={status.playbackState === 'playing' ? 'accent' : 'default'}>
            {status.playbackState}
          </Badge>
        </div>
        <ProgressBar value={progressPercent} label="Playback progress" />

        {status.playbackQueue.length > 0 ? (
          <ul className="queue-list" aria-label="Playback queue">
            {status.playbackQueue.map((item, index) => (
              <li key={`${item.phraseId}-${index}`} className="queue-item">
                <span>
                  {index + 1}. {item.name}
                </span>
                <Button size="sm" variant="ghost" onClick={() => void actions.removeQueued(item.phraseId)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {visiblePhrases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__title">No phrases match</div>
          <p>Import WAV files or clear your filters.</p>
        </div>
      ) : (
        <div className="phrase-grid">
          {visiblePhrases.map((phrase) => {
            const playing = status.playingPhraseId === phrase.id
            const binding = status.hotkeyBindings.find((entry) => entry.phraseId === phrase.id)
            return (
              <div
                key={phrase.id}
                className={`card phrase-card card--interactive${playing ? ' card--playing' : ''}`}
                draggable
                data-dragging={draggingId === phrase.id ? 'true' : 'false'}
                onDragStart={() => {
                  dragId.current = phrase.id
                  setDraggingId(phrase.id)
                }}
                onDragEnd={() => {
                  dragId.current = null
                  setDraggingId(null)
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  const fromId = dragId.current
                  dragId.current = null
                  setDraggingId(null)
                  if (!fromId || fromId === phrase.id) {
                    return
                  }
                  const targetIndex = ordered.findIndex((entry) => entry.id === phrase.id)
                  void actions.reorderToIndex(fromId, targetIndex)
                }}
              >
                <div className="phrase-card__top">
                  <div>
                    <div className="phrase-card__name">{phrase.name}</div>
                    <div className="card__meta">
                      {formatDuration(phrase.durationMs)}
                      {phrase.category ? ` · ${phrase.category}` : ''}
                      {phrase.enabled ? '' : ' · disabled'}
                    </div>
                  </div>
                  <div className="row">
                    <ShortcutBadge shortcut={phrase.shortcut} />
                    {binding && !binding.registered ? (
                      <Badge tone="warning">Hotkey issue</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="phrase-card__actions">
                  <Button
                    variant="primary"
                    disabled={busy || !connected || !phrase.enabled}
                    onClick={() => void actions.playPhrase(phrase.id)}
                  >
                    <IconPlay width={14} height={14} />
                    Play
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void actions.toggleEnabled(phrase.id, phrase.enabled)}
                  >
                    {phrase.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'rename', phrase })}>
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDialog({ kind: 'category', phrase })}
                  >
                    Category
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onNavigate('hotkeys', phrase.id)}
                  >
                    Assign hotkey
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDialog({ kind: 'remove', phrase })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(status.playbackError || status.lastPlaybackEvent) && (
        <p className="card__meta">
          {status.playbackError ? (
            <span className="error-text">{status.playbackError}</span>
          ) : (
            <>Last event: {status.lastPlaybackEvent}</>
          )}
        </p>
      )}

      <Dialog
        open={dialog?.kind === 'rename'}
        title="Rename phrase"
        inputDefault={dialog?.kind === 'rename' ? dialog.phrase.name : ''}
        confirmLabel="Save"
        onCancel={() => setDialog(null)}
        onConfirm={(value) => {
          if (dialog?.kind === 'rename' && value != null) {
            void actions.rename(dialog.phrase.id, value)
          }
          setDialog(null)
        }}
      />
      <Dialog
        open={dialog?.kind === 'category'}
        title="Set category"
        description="Leave empty to clear the category."
        inputDefault={dialog?.kind === 'category' ? (dialog.phrase.category ?? '') : ''}
        confirmLabel="Save"
        onCancel={() => setDialog(null)}
        onConfirm={(value) => {
          if (dialog?.kind === 'category' && value != null) {
            void actions.setCategory(dialog.phrase.id, value.trim() === '' ? null : value)
          }
          setDialog(null)
        }}
      />
      <Dialog
        open={dialog?.kind === 'remove'}
        title="Remove phrase?"
        description="This removes the phrase from your library."
        confirmLabel="Remove"
        danger
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'remove') {
            void actions.remove(dialog.phrase.id)
          }
          setDialog(null)
        }}
      />
    </div>
  )
}
