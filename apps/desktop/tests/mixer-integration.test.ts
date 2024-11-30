import { type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { createLoggerFactory } from '../src/main/logger'
import { extractSuccessData, PipeClient } from '../src/main/ipc/pipe-client'
import {
  resolveStagedSidecarDll,
  resolveToneFixture,
  startStagedSidecar
} from './sidecar-test-helpers'

const children: ChildProcessWithoutNullStreams[] = []
const clients: PipeClient[] = []

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect()
  }

  for (const child of children.splice(0)) {
    if (!child.killed) {
      child.kill()
    }
  }
})

describe('Mixer integration', () => {
  it('lists inputs, sets gains, starts mic, plays WAV, and stops independently', async () => {
    const dll = resolveStagedSidecarDll()
    if (!dll) {
      throw new Error('Sidecar DLL missing; build the audio-sidecar project first.')
    }

    const fixture = resolveToneFixture()
    expect(existsSync(fixture)).toBe(true)

    const pipeName = `ZoomDialerMixer-${randomBytes(8).toString('hex')}`
    await startStagedSidecar(pipeName, dll, children)

    const logger = createLoggerFactory({ minimumLevel: 'critical', sinks: [] }).createLogger(
      'mixer-integration'
    )
    const client = new PipeClient({ pipeName, logger })
    clients.push(client)
    await connectWithRetry(client)

    const listed = await client.request('GetAudioInputDevices', {})
    const list = extractSuccessData<{
      devices: Array<{
        id: string
        friendlyName: string
        isDefault: boolean
        supportsCapture: boolean
      }>
    }>(listed)
    expect(list.devices.length).toBeGreaterThan(0)
    expect(list.devices.some((d) => d.supportsCapture)).toBe(true)

    const gains = await client.request('SetMixerGains', {
      microphoneGain: 0.35,
      playbackGain: 0.55,
      masterGain: 0.8
    })
    const gainData = extractSuccessData<{
      microphoneGain: number
      playbackGain: number
      masterGain: number
      succeeded: boolean
    }>(gains)
    expect(gainData.succeeded).toBe(true)
    expect(gainData.microphoneGain).toBeCloseTo(0.35, 5)
    expect(gainData.playbackGain).toBeCloseTo(0.55, 5)
    expect(gainData.masterGain).toBeCloseTo(0.8, 5)

    const startMic = await client.request('StartMicrophone', {})
    expect((startMic.payload as { ok?: boolean } | null)?.ok).toBe(true)

    const levelsEnvelope = await waitForEvent(client, 'AudioLevels', 5_000)
    const levels = levelsEnvelope.payload as {
      microphonePeak?: number
      microphoneRms?: number
      playbackPeak?: number
      playbackRms?: number
      outputPeak?: number
      outputRms?: number
      microphoneClipped?: boolean
      playbackClipped?: boolean
      outputClipped?: boolean
    } | null
    expect(typeof levels?.microphonePeak).toBe('number')
    expect(typeof levels?.playbackPeak).toBe('number')
    expect(typeof levels?.outputPeak).toBe('number')
    expect(typeof levels?.microphoneClipped).toBe('boolean')
    expect(typeof levels?.playbackClipped).toBe('boolean')
    expect(typeof levels?.outputClipped).toBe('boolean')

    const tone = await client.request('PlayTestTone', {
      kind: 'sine',
      frequencyHz: 440,
      volume: 0.2,
      durationMs: 300
    })
    const toneData = extractSuccessData<{
      playbackId: string
      succeeded: boolean
      kind: string
      durationMs?: number | null
    }>(tone)
    expect(toneData.succeeded).toBe(true)
    expect(toneData.kind).toBe('sine')
    expect(toneData.playbackId).toBeTruthy()

    const play = await client.request('PlayAudio', { path: fixture, volume: 0.15 })
    const playData = extractSuccessData<{ phraseId: string; succeeded: boolean }>(play)
    expect(playData.succeeded).toBe(true)
    expect(playData.phraseId).toBeTruthy()

    await client.request('StopPlayback', {})
    const stopMic = await client.request('StopMicrophone', {})
    expect((stopMic.payload as { ok?: boolean } | null)?.ok).toBe(true)
  }, 45_000)
})

async function waitForEvent(
  client: PipeClient,
  type: string,
  timeoutMs: number
): Promise<import('../src/shared/protocol').MessageEnvelope> {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off('protocolEvent', onEvent)
      reject(new Error(`Timed out waiting for ${type}`))
    }, timeoutMs)

    const onEvent = (envelope: import('../src/shared/protocol').MessageEnvelope): void => {
      if (envelope.type !== type) {
        return
      }
      clearTimeout(timer)
      client.off('protocolEvent', onEvent)
      resolve(envelope)
    }

    client.on('protocolEvent', onEvent)
  })
}

async function connectWithRetry(client: PipeClient): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await client.connect()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
