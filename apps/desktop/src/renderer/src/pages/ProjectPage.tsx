import { useState } from 'react'
import type { DesktopController } from '../hooks/useDesktopController'
import { formatTimestamp } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'

export function ProjectPage({ controller }: { readonly controller: DesktopController }) {
  const { status, busy, actions } = controller
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="stack stack--lg">
      <PageHeader
        title="Project"
        description="Import audio, back up settings, or start fresh."
        actions={
          <Button variant="primary" disabled={busy} onClick={() => void actions.importWavs()}>
            Import WAVs
          </Button>
        }
      />

      <div className="page-grid page-grid--2">
        <div className="card stack">
          <h2 className="card__title">Library</h2>
          <p className="card__meta">
            {status.phrases.length} phrase{status.phrases.length === 1 ? '' : 's'} in this project.
          </p>
          <Button variant="secondary" disabled={busy} onClick={() => void actions.importWavs()}>
            Import WAV files
          </Button>
        </div>

        <div className="card stack">
          <h2 className="card__title">Settings file</h2>
          <dl className="definition-list">
            <dt>Save state</dt>
            <dd>{status.settingsSaveState}</dd>
            <dt>Last saved</dt>
            <dd>{formatTimestamp(status.settingsLastSavedAtMs)}</dd>
          </dl>
          <div className="row">
            <Button variant="secondary" disabled={busy} onClick={() => void actions.exportSettings()}>
              Export settings
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void actions.importSettings()}>
              Import settings
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setConfirmReset(true)}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="card stack">
        <h2 className="card__title">Project information</h2>
        <p className="card__meta">
          Phrases, device choices, gains, and playback mode are saved automatically with your
          project settings. Audio assets live alongside imported WAV and generated speech files.
        </p>
        <dl className="definition-list">
          <dt>Phrases</dt>
          <dd>{status.phrases.length}</dd>
          <dt>Category filter</dt>
          <dd>{status.categoryFilter || 'All'}</dd>
          <dt>Playback mode</dt>
          <dd>{status.playbackMode}</dd>
        </dl>
      </div>

      <Dialog
        open={confirmReset}
        title="Reset project?"
        description="This restores default settings and clears the phrase library."
        confirmLabel="Reset"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false)
          void actions.resetSettings()
        }}
      />
    </div>
  )
}
