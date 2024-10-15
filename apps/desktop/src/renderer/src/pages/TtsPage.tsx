import { useEffect, useState } from 'react'
import type { DesktopController } from '../hooks/useDesktopController'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Field, Input, Select, Slider, TextArea } from '../components/ui/Field'

export function TtsPage({ controller }: { readonly controller: DesktopController }) {
  const { busy, connected, ttsVoices, actions } = controller
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [rate, setRate] = useState(0)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    setVoiceId((current) => {
      if (current && ttsVoices.some((voice) => voice.id === current)) {
        return current
      }
      return ttsVoices[0]?.id ?? ''
    })
  }, [ttsVoices])

  const canGenerate = connected && ttsVoices.length > 0 && text.trim().length > 0

  return (
    <div className="stack stack--lg">
      <PageHeader
        title="Text to Speech"
        description="Write text, preview it, then save it as a playable phrase."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={busy || !canGenerate}
              onClick={() =>
                void actions.previewTts({
                  text,
                  voiceId: voiceId || null,
                  rate,
                  volume
                })
              }
            >
              Preview
            </Button>
            <Button
              variant="primary"
              disabled={busy || !canGenerate}
              onClick={() =>
                void actions.createTtsPhrase({
                  name,
                  text,
                  voiceId: voiceId || null,
                  rate,
                  volume
                })
              }
            >
              Generate
            </Button>
          </>
        }
      />

      <div className="card stack tts-editor">
        <Field label="Name" htmlFor="tts-name">
          <Input
            id="tts-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Phrase name"
          />
        </Field>
        <Field label="Text" htmlFor="tts-text">
          <TextArea
            id="tts-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type what you want to say…"
          />
        </Field>
        <div className="page-grid page-grid--3">
          <Field label="Voice" htmlFor="tts-voice">
            <Select
              id="tts-voice"
              value={voiceId}
              disabled={ttsVoices.length === 0}
              onChange={(event) => setVoiceId(event.target.value)}
            >
              {ttsVoices.length === 0 ? (
                <option value="">No voices installed</option>
              ) : (
                ttsVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.displayName}
                    {voice.language ? ` (${voice.language})` : ''}
                    {voice.gender ? ` · ${voice.gender}` : ''}
                  </option>
                ))
              )}
            </Select>
          </Field>
          <Slider
            id="tts-rate"
            label="Rate"
            min={-10}
            max={10}
            step={1}
            value={rate}
            onChange={setRate}
          />
          <Slider
            id="tts-volume"
            label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            format={(value) => value.toFixed(2)}
            onChange={setVolume}
          />
        </div>
        {name.trim() || text.trim() ? (
          <div className="card" style={{ background: 'var(--bg-muted)' }}>
            <div className="section-label">Preview card</div>
            <strong>{name.trim() || 'Untitled phrase'}</strong>
            <p className="card__meta" style={{ marginTop: '0.5rem' }}>
              {text.trim() || 'No text yet'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
