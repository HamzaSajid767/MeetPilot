import type { DesktopController } from '../hooks/useDesktopController'
import type { UiPreferences } from '../hooks/useUiPreferences'
import { PageHeader } from '../components/layout/PageHeader'
import { Field, Select, Switch } from '../components/ui/Field'

export function SettingsPage({
  preferences,
  onUpdatePreferences,
  controller,
  apiVersion
}: {
  readonly preferences: UiPreferences
  readonly onUpdatePreferences: (patch: Partial<UiPreferences>) => void
  readonly controller: DesktopController
  readonly apiVersion: string
}) {
  const { status } = controller

  return (
    <div className="stack stack--lg">
      <PageHeader
        title="Settings"
        description="Personalize appearance and reveal advanced tools when you need them."
      />

      <div className="card stack">
        <h2 className="card__title">Appearance</h2>
        <Field label="Theme" htmlFor="theme">
          <Select
            id="theme"
            value={preferences.theme}
            onChange={(event) =>
              onUpdatePreferences({ theme: event.target.value === 'light' ? 'light' : 'dark' })
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </Select>
        </Field>
        <Switch
          id="reduce-motion"
          label="Reduce animations"
          checked={preferences.reduceMotion}
          onChange={(checked) => onUpdatePreferences({ reduceMotion: checked })}
        />
      </div>

      <div className="card stack">
        <h2 className="card__title">Advanced</h2>
        <Switch
          id="developer-mode"
          label="Developer mode"
          checked={preferences.developerMode}
          onChange={(checked) => onUpdatePreferences({ developerMode: checked })}
        />
        <p className="card__meta">
          Shows API version, validation checklist, and test tone controls.
        </p>
      </div>

      {preferences.developerMode ? (
        <>
          <div className="card stack">
            <h2 className="card__title">Developer details</h2>
            <dl className="definition-list">
              <dt>Desktop API</dt>
              <dd>{apiVersion}</dd>
              <dt>Protocol</dt>
              <dd>{status.protocolVersion ?? '—'}</dd>
              <dt>Sidecar</dt>
              <dd>{status.sidecarVersion ?? '—'}</dd>
              <dt>Last response</dt>
              <dd>{status.lastResponse ?? '—'}</dd>
              <dt>Last error</dt>
              <dd>{status.lastError ?? '—'}</dd>
            </dl>
          </div>

          <div className="card stack">
            <h2 className="card__title">Zoom setup checklist</h2>
            <ol className="checklist">
              <li>Install VB-CABLE (or another compatible virtual audio device).</li>
              <li>Select the virtual playback device under Audio Devices.</li>
              <li>Set Zoom Phone microphone to the matching virtual microphone.</li>
              <li>Import WAVs and play a phrase from the Soundboard.</li>
              <li>Confirm Zoom’s microphone meter responds.</li>
              <li>If possible, confirm a remote participant hears playback.</li>
            </ol>
          </div>
        </>
      ) : null}
    </div>
  )
}
