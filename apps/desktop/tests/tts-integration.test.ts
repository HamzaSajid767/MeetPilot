import { type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createLoggerFactory } from '../src/main/logger'
import { extractSuccessData, PipeClient } from '../src/main/ipc/pipe-client'
import {
  resolveStagedSidecarDll,
  startStagedSidecar
} from './sidecar-test-helpers'

const children: ChildProcessWithoutNullStreams[] = []
const clients: PipeClient[] = []
const tempRoots: string[] = []

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect()
  }

  for (const child of children.splice(0)) {
    if (!child.killed) {
      child.kill()
    }
  }

  await Promise.all(
    tempRoots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true })
    })
  )
})

describe('TTS pipe integration', () => {
  it('enumerates voices and synthesizes a WAV when voices exist', async () => {
    const dll = resolveStagedSidecarDll()
    if (!dll) {
      throw new Error('Sidecar DLL missing; build the audio-sidecar project first.')
    }

    const pipeName = `ZoomDialerTts-${randomBytes(8).toString('hex')}`
    await startStagedSidecar(pipeName, dll, children)

    const logger = createLoggerFactory({ minimumLevel: 'critical', sinks: [] }).createLogger(
      'tts-integration'
    )
    const client = new PipeClient({ pipeName, logger })
    clients.push(client)
    await connectWithRetry(client)

    const voicesResponse = await client.request('GetAvailableVoices', {})
    const voicesData = extractSuccessData<{
      voices: Array<{ id: string; displayName: string }>
    }>(voicesResponse)

    if (voicesData.voices.length === 0) {
      return
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'zoom-dialer-tts-'))
    tempRoots.push(tempDir)
    const outputPath = path.join(tempDir, 'speech.wav')

    const synthResponse = await client.request(
      'SynthesizeSpeech',
      {
        text: 'Hello from Zoom Dialer.',
        voiceId: voicesData.voices[0]!.id,
        rate: 0,
        volume: 0.5,
        outputPath
      },
      undefined,
      60_000
    )

    const synthData = extractSuccessData<{ path: string; durationMs: number; succeeded: boolean }>(
      synthResponse
    )
    expect(synthData.succeeded).toBe(true)
    expect(synthData.path).toBe(outputPath)
    expect(synthData.durationMs).toBeGreaterThan(0)
  }, 90_000)
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
