import { type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { createLoggerFactory } from '../src/main/logger'
import { extractSuccessData, PipeClient } from '../src/main/ipc/pipe-client'
import type { ApplicationStateDto, VersionInfoDto } from '@zoom-dialer/shared-protocol'
import { resolveStagedSidecarDll, startStagedSidecar } from './sidecar-test-helpers'

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

describe('main↔sidecar named pipe integration', () => {
  it('completes Ping, GetVersion, HealthCheck and reconnects after restart', async () => {
    const dll = resolveStagedSidecarDll()
    if (!dll) {
      throw new Error('Sidecar DLL missing; build the audio-sidecar project first.')
    }

    const pipeName = `ZoomDialerIntegration-${randomBytes(8).toString('hex')}`
    let child = await startStagedSidecar(pipeName, dll, children)

    const logger = createLoggerFactory({ minimumLevel: 'critical', sinks: [] }).createLogger(
      'integration'
    )
    const client = new PipeClient({ pipeName, logger })
    clients.push(client)

    await connectWithRetry(client)

    const ping = await client.request('Ping', { nonce: 'integration' })
    expect(extractSuccessData<{ nonce: string }>(ping).nonce).toBe('integration')

    const version = await client.request('GetVersion', {})
    const versionData = extractSuccessData<VersionInfoDto>(version)
    expect(versionData.protocolVersion).toBe('1.0.0')
    expect(versionData.applicationVersion).toBeTruthy()

    const health = await client.request('HealthCheck', {})
    const healthData = extractSuccessData<ApplicationStateDto>(health)
    expect(healthData.isHealthy).toBe(true)
    expect(healthData.engineState).toBe('Idle')

    child.kill()
    await new Promise((resolve) => setTimeout(resolve, 300))
    client.disconnect()

    child = await startStagedSidecar(pipeName, dll, children)
    const client2 = new PipeClient({ pipeName, logger })
    clients.push(client2)
    await connectWithRetry(client2)

    const ping2 = await client2.request('Ping', { nonce: 'after-restart' })
    expect(extractSuccessData<{ nonce: string }>(ping2).nonce).toBe('after-restart')
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
