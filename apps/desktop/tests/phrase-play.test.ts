import { describe, expect, it, vi } from 'vitest'
import { PhraseLibrary } from '../src/main/phrase-library'
import { createInitialSidecarStatus } from '../src/shared/sidecar-status'
import { resolveToneFixture } from './sidecar-test-helpers'

describe('playPhrase resolution', () => {
  it('resolves an enabled phrase path for playback', async () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const { imported } = library.importPaths([fixture])
    const phrase = imported[0]!

    const playAudio = vi.fn(async (filePath: string, volume: number) => {
      expect(filePath).toBe(phrase.filePath)
      expect(volume).toBe(1)
      return {
        ...createInitialSidecarStatus(),
        playbackState: 'playing' as const,
        selectedWavPath: filePath,
        playingPhraseId: phrase.id,
        playingPhraseName: phrase.name
      }
    })

    const resolved = library.get(phrase.id)
    expect(resolved).toBeTruthy()
    expect(resolved!.enabled).toBe(true)
    await playAudio(resolved!.filePath, 1)
    expect(playAudio).toHaveBeenCalledOnce()
  })

  it('rejects missing and disabled phrases before play', () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const { imported } = library.importPaths([fixture])
    const phrase = imported[0]!
    library.setEnabled(phrase.id, false)

    expect(library.get('missing-id')).toBeUndefined()
    expect(library.get(phrase.id)?.enabled).toBe(false)
  })
})
