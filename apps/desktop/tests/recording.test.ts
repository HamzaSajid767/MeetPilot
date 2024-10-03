import { describe, expect, it } from 'vitest'
import { PhraseLibrary } from '../src/main/phrase-library'
import {
  assertRecordingDuration,
  DEFAULT_RECORDED_CATEGORY,
  normalizeRecordingCategory,
  RECORDING_MIN_DURATION_MS,
  validateRecordingName
} from '../src/shared/recording'
import { resolveToneFixture } from './sidecar-test-helpers'

describe('recording validation', () => {
  it('rejects short recordings and invalid names', () => {
    expect(() => assertRecordingDuration(0)).toThrow(/too short/)
    expect(() => assertRecordingDuration(RECORDING_MIN_DURATION_MS - 1)).toThrow(/too short/)
    expect(() => assertRecordingDuration(RECORDING_MIN_DURATION_MS)).not.toThrow()
    expect(() => validateRecordingName('')).toThrow(/name/i)
    expect(() => validateRecordingName('bad:name')).toThrow(/invalid/)
  })

  it('defaults category to Recorded', () => {
    expect(normalizeRecordingCategory(null)).toBe(DEFAULT_RECORDED_CATEGORY)
    expect(normalizeRecordingCategory('')).toBe(DEFAULT_RECORDED_CATEGORY)
    expect(normalizeRecordingCategory(' Custom ')).toBe('Custom')
  })
})

describe('recorded phrase library integration', () => {
  it('adds a recorded WAV with Recorded category', () => {
    const library = new PhraseLibrary()
    const phrase = library.addGeneratedPhrase({
      id: 'rec001',
      name: 'Take one',
      filePath: resolveToneFixture(),
      durationMs: 900,
      category: DEFAULT_RECORDED_CATEGORY
    })

    expect(phrase.category).toBe('Recorded')
    expect(library.list()[0]!.name).toBe('Take one')
  })
})
