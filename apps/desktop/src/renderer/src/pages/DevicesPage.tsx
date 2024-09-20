import type { DesktopController } from '../hooks/useDesktopController'
import { levelPercent, virtualRoutingLabel } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Field, Select } from '../components/ui/Field'
import { Meter } from '../components/ui/Meter'

export function DevicesPage({ controller }: { readonly controller: DesktopController }) {
  const { status, busy, connected, actions } = controller
  const selectableDevices = status.outputDevices.filter((device) => device.supportsPlayback)
  const selectedValue =
    status.selectedOutputDeviceId ??
    selectableDevices.find((device) => device.isDefault)?.id ??
    ''
  const selectableInputs = status.inputDevices.filter((device) => device.supportsCapture)
  const selectedMicValue =
    status.selectedInputDeviceId ??
    selectableInputs.find((device) => device.isDefault)?.id ??
    ''

  return (
    <div className="stack stack--lg">
      <PageHeader
        title="Audio Devices"
        description="Choose the microphone and speaker path Zoom will hear."
        actions={
          <Button
            variant="secondary"
            disabled={busy || !connected}
            onClick={() => {
              void actions.refreshInputs()
              void actions.refreshOutputs()
            }}
          >
            Refresh devices
          </Button>
        }
      />

      <div className="page-grid page-grid--2">
        <div className="card stack device-panel">
          <h2 className="card__title">Microphone</h2>
          <Field label="Input" htmlFor="input-device">
            <Select
              id="input-device"
              value={selectedMicValue}
              disabled={busy || !connected || selectableInputs.length === 0}
              onChange={(event) => void actions.selectMicrophone(event.target.value)}
            >
              {selectableInputs.length === 0 ? <option value="">No devices</option> : null}
              {selectableInputs.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.friendlyName}
                  {device.isVirtualDevice ? ' (virtual)' : ''}
                  {device.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="row">
            <Button
              variant="primary"
              disabled={busy || !connected || status.microphoneActive}
              onClick={() => void actions.startMic()}
            >
              Start mic
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !connected || !status.microphoneActive}
              onClick={() => void actions.stopMic()}
            >
              Stop mic
            </Button>
          </div>
          <Meter value={levelPercent(status.microphonePeak)} clipped={status.microphoneClipped} />
          <p className="card__meta">
            {status.microphoneActive ? 'Live' : 'Off'} · {status.captureDeviceName ?? '—'}
          </p>
          {status.microphoneError ? <p className="error-text">{status.microphoneError}</p> : null}
        </div>

        <div className="card stack device-panel">
          <h2 className="card__title">Speaker</h2>
          <Field label="Output" htmlFor="output-device">
            <Select
              id="output-device"
              value={selectedValue}
              disabled={busy || !connected || selectableDevices.length === 0}
              onChange={(event) => void actions.selectOutput(event.target.value)}
            >
              {selectableDevices.length === 0 ? <option value="">No devices</option> : null}
              {selectableDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.friendlyName}
                  {device.isVirtualDevice ? ' (virtual)' : ''}
                  {device.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Meter value={levelPercent(status.outputPeak)} clipped={status.outputClipped} />
          <p className="card__meta">{virtualRoutingLabel(status.virtualRoutingStatus)}</p>
          {!status.hasVirtualOutputDevice ? (
            <p className="error-text">
              No virtual cable detected. Install VB-CABLE to route audio into Zoom Phone.
            </p>
          ) : null}
          {status.outputDeviceWarning ? (
            <p className="error-text">{status.outputDeviceWarning}</p>
          ) : null}
        </div>
      </div>

      <div className="card stack">
        <h2 className="card__title">Connection diagnostics</h2>
        <dl className="definition-list">
          <dt>Connection</dt>
          <dd>{status.connectionState}</dd>
          <dt>Health</dt>
          <dd>{status.healthLabel ?? '—'}</dd>
          <dt>Latency</dt>
          <dd>{status.lastLatencyMs == null ? '—' : `${status.lastLatencyMs} ms`}</dd>
          <dt>Virtual cable</dt>
          <dd>{status.selectedIsVirtual ? 'Selected' : 'Not selected'}</dd>
          <dt>Last error</dt>
          <dd>{status.lastError ?? '—'}</dd>
        </dl>
      </div>
    </div>
  )
}
