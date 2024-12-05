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

describe('Output device integration', () => {
  it('lists devices, selects one, rejects invalid id, and plays on selection', async () => {
    const dll = resolveStagedSidecarDll()
    if (!dll) {
      throw new Error('Sidecar DLL missing; build the audio-sidecar project first.')
    }

    const fixture = resolveToneFixture()
    expect(existsSync(fixture)).toBe(true)

    const pipeName = `ZoomDialerOutputDevices-${randomBytes(8).toString('hex')}`
    await startStagedSidecar(pipeName, dll, children)

    const logger = createLoggerFactory({ minimumLevel: 'critical', sinks: [] }).createLogger(
      'output-device-integration'
    )
    const client = new PipeClient({ pipeName, logger })
    clients.push(client)
    await connectWithRetry(client)

    const listed = await client.request('GetAudioOutputDevices', {})
    const list = extractSuccessData<{
      devices: Array<{
        id: string
        friendlyName: string
        isDefault: boolean
        deviceState: string
        supportsPlayback: boolean
        isVirtualDevice: boolean
      }>
    }>(listed)
    expect(list.devices.length).toBeGreaterThan(0)
    expect(list.devices.some((d) => d.isDefault)).toBe(true)
    expect(list.devices.every((d) => typeof d.isVirtualDevice === 'boolean')).toBe(true)

    const target = list.devices.find((d) => d.supportsPlayback)
    expect(target).toBeTruthy()

    const setOk = await client.request('SetOutputDevice', { deviceId: target!.id })
    const setData = extractSuccessData<{ deviceId: string; succeeded: boolean }>(setOk)
    expect(setData.succeeded).toBe(true)
    expect(setData.deviceId).toBe(target!.id)

    const setBad = await client.request('SetOutputDevice', {
      deviceId: `missing-${randomBytes(4).toString('hex')}`
    })
    expect((setBad.payload as { code?: string } | null)?.code).toBe('DeviceUnavailable')

    const play = await client.request('PlayAudio', { path: fixture, volume: 0.15 })
    const playData = extractSuccessData<{
      phraseId: string
      succeeded: boolean
      outputDeviceId?: string | null
      usedFallbackDevice?: boolean | null
    }>(play)
    expect(playData.succeeded).toBe(true)
    expect(playData.outputDeviceId).toBe(target!.id)
    expect(playData.usedFallbackDevice).not.toBe(true)

    await client.request('StopPlayback', {})
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
