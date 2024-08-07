import { describe, expect, it } from 'vitest'
import {
  createEmptyPeakHold,
  LEVEL_HISTORY_CAPACITY,
  LevelHistoryBuffer,
  resetPeakHold,
  updatePeakHold
} from '../src/shared/calibration'
import { normalizeSettings } from '../src/shared/settings'

describe('calibration helpers', () => {
  it('holds peak until reset', () => {
    let hold = createEmptyPeakHold()
    hold = updatePeakHold(hold, { microphone: 0.2, playback: 0.1, output: 0.3 }, true)
    hold = updatePeakHold(hold, { microphone: 0.05, playback: 0.4, output: 0.1 }, true)

    expect(hold.microphone.held).toBeCloseTo(0.2)
    expect(hold.playback.held).toBeCloseTo(0.4)
    expect(hold.output.held).toBeCloseTo(0.3)

    hold = resetPeakHold({ microphone: 0.05, playback: 0.4, output: 0.1 })
    expect(hold.microphone.held).toBeCloseTo(0.05)
    expect(hold.playback.held).toBeCloseTo(0.4)
  })

  it('caps history buffer length near 10 seconds at 10 Hz', () => {
    const buffer = new LevelHistoryBuffer()
    for (let i = 0; i < LEVEL_HISTORY_CAPACITY + 25; i++) {
      buffer.push(i / 1000)
    }
    expect(buffer.length).toBe(LEVEL_HISTORY_CAPACITY)
    const values = buffer.toArray()
    expect(values).toHaveLength(LEVEL_HISTORY_CAPACITY)
    expect(values[0]).toBeCloseTo(25 / 1000)
    expect(values[values.length - 1]).toBeCloseTo((LEVEL_HISTORY_CAPACITY + 24) / 1000)
  })
})

describe('normalizeSettings calibration + masterGain', () => {
  it('normalizes masterGain and calibration prefs with defaults', () => {
    const normalized = normalizeSettings({
      phrases: [],
      audio: { microphoneGain: 0.4, playbackGain: 0.6, masterGain: 2 },
      calibration: { showRms: false, peakHoldEnabled: 'yes', historyEnabled: false }
    })

    expect(normalized.audio.masterGain).toBe(1)
    expect(normalized.audio.microphoneGain).toBe(0.4)
    expect(normalized.calibration).toEqual({
      showRms: false,
      peakHoldEnabled: true,
      historyEnabled: false
    })
  })
})
