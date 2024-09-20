import type { PlaybackMode } from '../../../shared/playback'
import type { DesktopController } from '../hooks/useDesktopController'
import { formatDuration, levelPercent } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Field, Select, Slider, Switch } from '../components/ui/Field'
import { Meter, Sparkline } from '../components/ui/Meter'

export function PlaybackPage({
  controller,
  developerMode
}: {
  readonly controller: DesktopController
  readonly developerMode: boolean
}) {
  const {
    status,
    busy,
    connected,
    peakHold,
    micHistory,
    playHistory,
    outHistory,
    toneKind,
    toneVolume,
    setToneKind,
    setToneVolume,
    actions
  } = controller

  const channels = [
    {
      key: 'mic',
      label: 'Mic',
      peak: status.microphonePeak,
      rms: status.microphoneRms,
      clipped: status.microphoneClipped,
      hold: peakHold.microphone,
      history: micHistory
    },
    {
      key: 'play',
      label: 'Phrase',
      peak: status.playbackPeak,
      rms: status.playbackRms,
      clipped: status.playbackClipped,
      hold: peakHold.playback,
      history: playHistory
    },
    {
      key: 'out',
      label: 'Output',
      peak: status.outputPeak,
      rms: status.outputRms,
      clipped: status.outputClipped,
      hold: peakHold.output,
      history: outHistory
    }
  ] as const

  return (
    <div className="stack stack--lg">
      <PageHeader
        title="Playback"
        description="Control queue behavior, levels, and what plays next."
        actions={
          <>
            <Button variant="secondary" disabled={busy || !connected} onClick={() => void actions.skip()}>
              Skip
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void actions.clearQueue()}>
              Clear queue
            </Button>
          </>
        }
      />

      <div className="page-grid page-grid--2">
        <div className="card stack">
          <Field label="Playback mode" htmlFor="playback-mode">
            <Select
              id="playback-mode"
              value={status.playbackMode}
              onChange={(event) => void actions.setPlaybackMode(event.target.value as PlaybackMode)}
            >
              <option value="interrupt">Interrupt</option>
              <option value="queue">Queue</option>
              <option value="ignore">Ignore while busy</option>
            </Select>
          </Field>
          <dl className="definition-list">
            <dt>Current</dt>
            <dd>{status.playingPhraseName ?? '—'}</dd>
            <dt>Next</dt>
            <dd>{status.nextPhraseName ?? '—'}</dd>
            <dt>Duration</dt>
            <dd>
              {status.playbackDurationMs == null ? '—' : formatDuration(status.playbackDurationMs)}
            </dd>
            <dt>Queue</dt>
            <dd>{status.queueLength}</dd>
          </dl>
          {status.playbackQueue.length > 0 ? (
            <ul className="queue-list">
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
          ) : (
            <p className="muted">Queue is empty.</p>
          )}
        </div>

        <div className="card stack">
          <Slider
            id="mic-gain"
            label="Microphone gain"
            min={0}
            max={1}
            step={0.01}
            value={status.microphoneGain}
            disabled={!connected}
            format={(value) => value.toFixed(2)}
            onChange={(value) => void actions.setMicGain(value)}
          />
          <Slider
            id="play-gain"
            label="Phrase gain"
            min={0}
            max={1}
            step={0.01}
            value={status.playbackGain}
            disabled={!connected}
            format={(value) => value.toFixed(2)}
            onChange={(value) => void actions.setPlaybackGain(value)}
          />
          <Slider
            id="master-gain"
            label="Master gain"
            min={0}
            max={1}
            step={0.01}
            value={status.masterGain}
            disabled={!connected}
            format={(value) => value.toFixed(2)}
            onChange={(value) => void actions.setMasterGain(value)}
          />
        </div>
      </div>

      <div className="card stack">
        <div className="row row--between">
          <h2 className="card__title">Meters</h2>
          <div className="row">
            <Switch
              id="show-rms"
              label="Show RMS"
              checked={status.calibrationShowRms}
              onChange={(checked) => void actions.setCalibration({ showRms: checked })}
            />
            <Switch
              id="peak-hold"
              label="Peak hold"
              checked={status.calibrationPeakHoldEnabled}
              onChange={(checked) => void actions.setCalibration({ peakHoldEnabled: checked })}
            />
            <Switch
              id="history"
              label="History"
              checked={status.calibrationHistoryEnabled}
              onChange={(checked) => void actions.setCalibration({ historyEnabled: checked })}
            />
            <Button size="sm" variant="ghost" onClick={() => actions.resetPeakHold()}>
              Reset peak
            </Button>
          </div>
        </div>

        {channels.map((channel) => (
          <div key={channel.key} className="meter-row">
            <span className="meter-row__label">{channel.label}</span>
            <Meter
              value={levelPercent(channel.peak)}
              hold={levelPercent(channel.hold.held)}
              clipped={channel.clipped}
              showHold={status.calibrationPeakHoldEnabled}
            />
            <span className="meter-row__value">
              peak {channel.peak.toFixed(3)}
              {status.calibrationPeakHoldEnabled ? ` / hold ${channel.hold.held.toFixed(3)}` : ''}
              {status.calibrationShowRms ? ` / rms ${channel.rms.toFixed(3)}` : ''}
              {channel.clipped ? ' CLIP' : ''}
            </span>
            {status.calibrationHistoryEnabled ? <Sparkline values={channel.history} /> : null}
          </div>
        ))}
      </div>

      {developerMode ? (
        <div className="card stack">
          <h2 className="card__title">Test tone</h2>
          <div className="row">
            <Field label="Kind" htmlFor="tone-kind">
              <Select
                id="tone-kind"
                value={toneKind}
                onChange={(event) =>
                  setToneKind(event.target.value as 'sine' | 'pink' | 'white')
                }
              >
                <option value="sine">Sine (440 Hz)</option>
                <option value="pink">Pink</option>
                <option value="white">White</option>
              </Select>
            </Field>
            <Slider
              id="tone-volume"
              label="Volume"
              min={0}
              max={1}
              step={0.01}
              value={toneVolume}
              format={(value) => value.toFixed(2)}
              onChange={setToneVolume}
            />
          </div>
          <div className="row">
            <Button
              variant="primary"
              disabled={busy || !connected}
              onClick={() => void actions.playTestTone()}
            >
              Play tone
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !connected || status.playbackState !== 'playing'}
              onClick={() => void actions.stopTone()}
            >
              Stop
            </Button>
          </div>
          <p className="card__meta">
            Mixer {status.mixerRunning ? 'running' : 'stopped'} · Playback {status.playbackState}
          </p>
        </div>
      ) : null}
    </div>
  )
}
