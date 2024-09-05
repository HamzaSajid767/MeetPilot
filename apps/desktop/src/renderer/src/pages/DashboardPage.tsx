import { filterPhrases } from '../../../shared/phrase'
import type { DesktopController } from '../hooks/useDesktopController'
import type { NavView } from '../lib/navigation'
import { formatDuration, playbackModeLabel, virtualRoutingLabel } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { IconPlay } from '../components/ui/Icon'
import { Badge, Skeleton } from '../components/ui/Meter'
import { StatTile } from '../components/status/StatusWidgets'

export function DashboardPage({
  controller,
  onNavigate
}: {
  readonly controller: DesktopController
  readonly onNavigate: (view: NavView) => void
}) {
  const { status, statusReady, busy, connected, actions } = controller
  const recent = filterPhrases(status.phrases).filter((phrase) => phrase.enabled).slice(0, 6)
  const outputName =
    status.playbackOutputDeviceName ??
    status.outputDevices.find((device) => device.id === status.selectedOutputDeviceId)?.friendlyName ??
    'System default'
  const micName =
    status.captureDeviceName ??
    status.inputDevices.find((device) => device.id === status.selectedInputDeviceId)?.friendlyName ??
    'Not selected'

  if (!statusReady) {
    return (
      <div className="stack">
        <PageHeader title="Dashboard" description="Loading your workspace…" />
        <div className="page-grid page-grid--3">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    )
  }

  return (
    <div className="stack stack--lg">
      <PageHeader
        title="Dashboard"
        description="See health at a glance, then play a phrase in one click."
        actions={
          <Button variant="primary" onClick={() => onNavigate('soundboard')}>
            Open Soundboard
          </Button>
        }
      />

      <div className="page-grid page-grid--4">
        <StatTile
          label="Connection"
          value={status.connectionState === 'connected' ? 'Online' : status.connectionState}
          hint={status.healthLabel ?? 'Sidecar health'}
        />
        <StatTile
          label="Microphone"
          value={status.microphoneActive ? 'Live' : 'Off'}
          hint={micName}
        />
        <StatTile label="Speaker" value={outputName} hint={virtualRoutingLabel(status.virtualRoutingStatus)} />
        <StatTile
          label="Playback"
          value={playbackModeLabel(status.playbackMode)}
          hint={status.playingPhraseName ? `Now: ${status.playingPhraseName}` : 'Idle'}
        />
      </div>

      <div className="page-grid page-grid--2">
        <div className="card stack">
          <div className="row row--between">
            <h2 className="card__title">Now</h2>
            <Badge tone={status.playbackState === 'playing' ? 'accent' : 'default'}>
              {status.playbackState}
            </Badge>
          </div>
          <p>
            <strong>{status.playingPhraseName ?? 'Nothing playing'}</strong>
          </p>
          <p className="card__meta">
            Next: {status.nextPhraseName ?? '—'} · Queue {status.queueLength}
          </p>
          <p className="card__meta">
            Recording: {controller.isRecording ? controller.recordingElapsedLabel : 'Idle'}
          </p>
        </div>

        <div className="card stack">
          <h2 className="card__title">Health</h2>
          <p className="card__meta">
            Latency {status.lastLatencyMs == null ? '—' : `${status.lastLatencyMs} ms`} ·{' '}
            {status.lastError ? `Issue: ${status.lastError}` : 'No connection errors'}
          </p>
          {!status.hasVirtualOutputDevice ? (
            <p className="error-text">
              No virtual cable detected. Install VB-CABLE, then pick it under Audio Devices.
            </p>
          ) : null}
          <div className="row">
            <Button variant="secondary" onClick={() => onNavigate('devices')}>
              Audio Devices
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('record')}>
              Record
            </Button>
          </div>
        </div>
      </div>

      <section className="stack">
        <div className="row row--between">
          <h2 className="section-label" style={{ margin: 0 }}>
            Quick Play
          </h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('soundboard')}>
            View all
          </Button>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__title">No phrases yet</div>
            <p>Import WAV files or generate speech to get started.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              <Button variant="primary" onClick={() => onNavigate('project')}>
                Import WAVs
              </Button>
              <Button variant="secondary" onClick={() => onNavigate('tts')}>
                Text to Speech
              </Button>
            </div>
          </div>
        ) : (
          <div className="phrase-grid">
            {recent.map((phrase) => (
              <div key={phrase.id} className="card phrase-card card--interactive">
                <div className="phrase-card__top">
                  <div>
                    <div className="phrase-card__name">{phrase.name}</div>
                    <div className="card__meta">
                      {formatDuration(phrase.durationMs)}
                      {phrase.category ? ` · ${phrase.category}` : ''}
                    </div>
                  </div>
                  {phrase.shortcut ? <Badge tone="accent">{phrase.shortcut}</Badge> : null}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <h2 className="card__title">Recent activity</h2>
        <p className="card__meta">Last event: {status.lastPlaybackEvent ?? '—'}</p>
        <p className="card__meta">Last play result: {status.lastPlayOutcome ?? '—'}</p>
        <p className="card__meta">
          Project save: {status.settingsSaveState}
          {status.settingsLastSavedAtMs
            ? ` · ${new Date(status.settingsLastSavedAtMs).toLocaleString()}`
            : ''}
        </p>
      </section>
    </div>
  )
}
