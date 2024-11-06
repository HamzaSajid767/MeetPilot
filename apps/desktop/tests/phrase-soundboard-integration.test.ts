import { type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { createLoggerFactory } from '../src/main/logger'
import { extractSuccessData, PipeClient } from '../src/main/ipc/pipe-client'
import { PhraseLibrary } from '../src/main/phrase-library'
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

describe('Phrase soundboard integration', () => {
  it('imports a phrase path then plays it through PlayAudio', async () => {
    const dll = resolveStagedSidecarDll()
    if (!dll) {
      throw new Error('Sidecar DLL missing; build the audio-sidecar project first.')
    }

    const fixture = resolveToneFixture()
    expect(existsSync(fixture)).toBe(true)

    const library = new PhraseLibrary()
    const imported = library.importPaths([fixture])
    expect(imported.errors).toHaveLength(0)
    expect(imported.imported).toHaveLength(1)
    const phrase = imported.imported[0]!

    const pipeName = `ZoomDialerPhrases-${randomBytes(8).toString('hex')}`
    await startStagedSidecar(pipeName, dll, children)

    const logger = createLoggerFactory({ minimumLevel: 'critical', sinks: [] }).createLogger(
      'phrase-integration'
    )
    const client = new PipeClient({ pipeName, logger })
    clients.push(client)
    await connectWithRetry(client)

    const play = await client.request('PlayAudio', { path: phrase.filePath, volume: 0.2 })
    const playData = extractSuccessData<{ phraseId: string; succeeded: boolean }>(play)
    expect(playData.succeeded).toBe(true)
    expect(playData.phraseId).toBeTruthy()

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
