import { describe, expect, it } from 'vitest'
import { PhraseLibrary } from '../src/main/phrase-library'
import {
  clampTtsRate,
  clampTtsVolume,
  validateTtsName,
  validateTtsText
} from '../src/shared/tts'
import { resolveToneFixture } from './sidecar-test-helpers'

describe('TTS validation helpers', () => {
  it('rejects empty text and name', () => {
    expect(() => validateTtsText('')).toThrow(/Text is required/)
    expect(() => validateTtsText('   ')).toThrow(/Text is required/)
    expect(() => validateTtsName('')).toThrow(/Phrase name is required/)
    expect(() => validateTtsName('bad/name')).toThrow(/invalid characters/)
  })

  it('clamps rate and volume', () => {
    expect(clampTtsRate(100)).toBe(10)
    expect(clampTtsRate(-100)).toBe(-10)
    expect(clampTtsRate(2.6)).toBe(3)
    expect(clampTtsVolume(2)).toBe(1)
    expect(clampTtsVolume(-1)).toBe(0)
  })
})

describe('PhraseLibrary.addGeneratedPhrase', () => {
  it('adds a generated WAV like an imported phrase', () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const phrase = library.addGeneratedPhrase({
      id: 'tts001',
      name: 'Hello',
      filePath: fixture,
      durationMs: 1234,
      category: 'TTS'
    })

    expect(phrase.id).toBe('tts001')
    expect(phrase.name).toBe('Hello')
    expect(phrase.category).toBe('TTS')
    expect(phrase.enabled).toBe(true)
    expect(phrase.shortcut).toBeNull()
    expect(library.list()).toHaveLength(1)
    expect(library.get('tts001')?.durationMs).toBe(1234)
  })
})
