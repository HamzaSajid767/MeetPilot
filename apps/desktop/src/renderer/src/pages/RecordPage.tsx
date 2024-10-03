import { useState } from 'react'
import type { DesktopController } from '../hooks/useDesktopController'
import { levelPercent } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Waveform } from '../components/ui/Meter'

export function RecordPage({ controller }: { readonly controller: DesktopController }) {
  const {
    status,
    busy,
    connected,
    isRecording,
    pendingRecordingDurationMs,
    recordingElapsedLabel,
    recordingDefaultCategory,
    actions
  } = controller
  const [recordName, setRecordName] = useState('')
  const [recordCategory, setRecordCategory] = useState(recordingDefaultCategory)
  const level = levelPercent(status.microphonePeak) / 100
  const pending = pendingRecordingDurationMs != null

  return (
    <div className="stack stack--lg">
      <PageHeader
        title="Record"
        description="Capture a short phrase from your microphone."
      />

      <div className="card record-stage">
        <div className={`record-timer${isRecording ? ' recording-pulse' : ''}`}>
          {recordingElapsedLabel}
        </div>
        <Waveform level={isRecording ? Math.max(0.15, level) : level * 0.4} active={isRecording} />
        <p className="card__meta">Input level {Math.round(level * 100)}%</p>

        {!pending ? (
          <div className="row">
            {!isRecording ? (
              <button
                type="button"
                className="btn btn--record"
                disabled={busy || !connected}
                onClick={() => {
                  setRecordName('')
                  setRecordCategory(recordingDefaultCategory)
                  void actions.startRecording()
                }}
              >
                Record
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn--record"
                  data-active="true"
                  disabled={busy || !connected}
                  onClick={() => void actions.stopRecording()}
                >
                  Stop
                </button>
                <Button variant="ghost" disabled={busy} onClick={() => void actions.cancelRecording()}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="stack" style={{ width: 'min(28rem, 100%)' }}>
            <Field label="Name" htmlFor="record-name">
              <Input
                id="record-name"
                value={recordName}
                onChange={(event) => setRecordName(event.target.value)}
                placeholder="Phrase name"
              />
            </Field>
            <Field label="Category" htmlFor="record-category">
              <Input
                id="record-category"
                value={recordCategory}
                onChange={(event) => setRecordCategory(event.target.value)}
                placeholder={recordingDefaultCategory}
              />
            </Field>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void actions.saveRecording(recordName, recordCategory)}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setRecordName('')
                  setRecordCategory(recordingDefaultCategory)
                  void actions.discardRecording()
                }}
              >
                Discard
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void actions.cancelRecording()}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
