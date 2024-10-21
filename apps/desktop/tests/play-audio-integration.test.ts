import { type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createLoggerFactory } from '../src/main/logger'
import { extractSuccessData, PipeClient } from '../src/main/ipc/pipe-client'
import type { MessageEnvelope } from '../src/shared/protocol'
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

describe('PlayAudio integration', () => {
  it('plays a WAV, emits lifecycle events, and supports stop', async () => {
    const dll = resolveStagedSidecarDll()
    if (!dll) {
      throw new Error('Sidecar DLL missing; build the audio-sidecar project first.')
    }

    const fixture = resolveToneFixture()
    expect(existsSync(fixture)).toBe(true)

    const pipeName = `ZoomDialerPlayAudio-${randomBytes(8).toString('hex')}`
    await startStagedSidecar(pipeName, dll, children)

    const logger = createLoggerFactory({ minimumLevel: 'critical', sinks: [] }).createLogger(
      'play-integration'
    )
    const client = new PipeClient({ pipeName, logger })
    clients.push(client)
    await connectWithRetry(client)

    const events: MessageEnvelope[] = []
    client.on('protocolEvent', (envelope: MessageEnvelope) => {
      events.push(envelope)
    })

    const play = await client.request('PlayAudio', { path: fixture, volume: 0.2 })
    const accepted = extractSuccessData<{
      phraseId: string
      succeeded: boolean
      durationMs?: number
    }>(play)
    expect(accepted.succeeded).toBe(true)
    expect(accepted.phraseId).toBeTruthy()

    await waitForEvent(events, 'PlaybackStarted', 5_000)
    await waitForEvent(events, 'PlaybackCompleted', 10_000)

    const bad = await client.request('PlayAudio', {
      path: path.join(path.dirname(fixture), 'missing.wav'),
      volume: 0.5
    })
    expect((bad.payload as { code?: string } | null)?.code).toBe('InvalidMessage')

    const play2 = await client.request('PlayAudio', { path: fixture, volume: 0.2 })
    extractSuccessData(play2)
    await waitForEvent(events, 'PlaybackStarted', 5_000)
    const stop = await client.request('StopPlayback', {})
    extractSuccessData(stop)
    await waitForEvent(events, 'PlaybackCompleted', 5_000)
  }, 45_000)
})

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

async function waitForEvent(
  events: MessageEnvelope[],
  type: string,
  timeoutMs: number
): Promise<MessageEnvelope> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const found = events.find((event) => event.type === type)
    if (found) {
      const index = events.indexOf(found)
      events.splice(0, index + 1)
      return found
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error(`Timed out waiting for event ${type}`)
}
