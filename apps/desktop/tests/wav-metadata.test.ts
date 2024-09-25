import { writeFileSync, unlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readWavMetadata } from '../src/main/wav-metadata'
import { resolveToneFixture } from './sidecar-test-helpers'

describe('readWavMetadata', () => {
  it('reads duration from the tone fixture', () => {
    const fixture = resolveToneFixture()
    const meta = readWavMetadata(fixture)
    expect(meta.durationMs).toBeGreaterThan(0)
    expect(meta.sampleRate).toBeGreaterThan(0)
    expect(meta.channels).toBeGreaterThanOrEqual(1)
    expect([1, 3]).toContain(meta.audioFormat)
  })

  it('rejects non-wav extensions', () => {
    expect(() => readWavMetadata(path.join(os.tmpdir(), 'clip.mp3'))).toThrow(/\.wav/i)
  })

  it('rejects missing files', () => {
    expect(() =>
      readWavMetadata(path.join(os.tmpdir(), `missing-${Date.now()}.wav`))
    ).toThrow(/not found/i)
  })

  it('rejects truncated headers', () => {
    const temp = path.join(os.tmpdir(), `bad-wav-${Date.now()}.wav`)
    writeFileSync(temp, Buffer.from('RIFF'))
    try {
      expect(() => readWavMetadata(temp)).toThrow()
    } finally {
      unlinkSync(temp)
    }
  })

  it('rejects non-RIFF content with .wav extension', () => {
    const temp = path.join(os.tmpdir(), `not-riff-${Date.now()}.wav`)
    writeFileSync(temp, Buffer.alloc(64, 1))
    try {
      expect(() => readWavMetadata(temp)).toThrow(/RIFF|WAVE/i)
    } finally {
      unlinkSync(temp)
    }
  })
})
