import type { SidecarStatusSnapshot } from '../../../../shared/sidecar-status'
import { playbackModeLabel } from '../../lib/format'
import { Button } from '../ui/Button'
import { IconStop } from '../ui/Icon'
import { ProgressBar } from '../ui/Meter'
import { ConnectionPill } from '../status/StatusWidgets'

function healthState(status: SidecarStatusSnapshot): 'ok' | 'warn' | 'error' | 'idle' {
  if (status.connectionState === 'connected') {
    return status.healthLabel?.toLowerCase().includes('ok') || status.healthLabel == null
      ? 'ok'
      : 'warn'
  }
  if (status.connectionState === 'faulted') {
    return 'error'
  }
  if (status.connectionState === 'connecting' || status.connectionState === 'reconnecting') {
    return 'warn'
  }
  return 'idle'
}

export function StatusBar({
  status,
  progressPercent,
  busy,
  connected,
  onStop
}: {
  readonly status: SidecarStatusSnapshot
  readonly progressPercent: number
  readonly busy: boolean
  readonly connected: boolean
  readonly onStop: () => void
}) {
  const connectionLabel =
    status.connectionState === 'connected'
      ? 'Connected'
      : status.connectionState.charAt(0).toUpperCase() + status.connectionState.slice(1)

  return (
    <footer className="app-status-bar" aria-label="Playback status">
      <div className="app-status-bar__group">
        <ConnectionPill label={connectionLabel} state={healthState(status)} />
        <span>{playbackModeLabel(status.playbackMode)}</span>
      </div>
      <div className="app-status-bar__spacer" />
      <div className="app-status-bar__group app-status-bar__now" title={status.playingPhraseName ?? undefined}>
        {status.playbackState === 'playing' ? (
          <>
            <span>Playing · {status.playingPhraseName ?? 'Phrase'}</span>
            <div style={{ width: '7rem' }}>
              <ProgressBar value={progressPercent} label="Playback progress" />
            </div>
          </>
        ) : (
          <span className="muted">Ready</span>
        )}
      </div>
      <Button
        variant="danger"
        size="sm"
        disabled={busy || !connected || status.playbackState !== 'playing'}
        onClick={onStop}
        aria-label="Stop playback"
      >
        <IconStop width={12} height={12} />
        Stop
      </Button>
    </footer>
  )
}
