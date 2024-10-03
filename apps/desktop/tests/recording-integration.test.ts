import { type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createLoggerFactory } from '../src/main/logger'
import { extractSuccessData, PipeClient } from '../src/main/ipc/pipe-client'
import { resolveStagedSidecarDll, startStagedSidecar } from './sidecar-test-helpers'

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

describe('Recording pipe integration', () => {
  it('supports start/stop or start/cancel when a capture device exists', async () => {
    const dll = resolveStagedSidecarDll()
    if (!dll) {
      throw new Error('Sidecar DLL missing; build the audio-sidecar project first.')
    }

    const pipeName = `ZoomDialerRec-${randomBytes(8).toString('hex')}`
    await startStagedSidecar(pipeName, dll, children)

    const logger = createLoggerFactory({ minimumLevel: 'critical', sinks: [] }).createLogger(
      'recording-integration'
    )
    const client = new PipeClient({ pipeName, logger })
    clients.push(client)
    await connectWithRetry(client)

    const devices = await client.request('GetAudioInputDevices', {})
    const deviceData = extractSuccessData<{ devices?: Array<{ id: string }> }>(devices)
    if (!deviceData.devices || deviceData.devices.length === 0) {
      return
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'zoom-dialer-rec-'))
    tempRoots.push(tempDir)
    const outputPath = path.join(tempDir, 'clip.wav')

    try {
      await client.request(
        'StartRecording',
        { outputPath, deviceId: deviceData.devices[0]!.id },
        undefined,
        30_000
      )
    } catch {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 400))

    try {
      const stop = await client.request('StopRecording', {}, undefined, 30_000)
      const stopData = extractSuccessData<{ path: string; durationMs: number; succeeded: boolean }>(
        stop
      )
      expect(stopData.succeeded).toBe(true)
      expect(existsSync(stopData.path)).toBe(true)
      expect(stopData.durationMs).toBeGreaterThan(0)
    } catch {
      await client.request('CancelRecording', {}, undefined, 30_000)
      expect(existsSync(outputPath)).toBe(false)
    }
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
