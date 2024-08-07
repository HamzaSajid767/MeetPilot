/**
 * Desktop-only peak hold and short level history for calibration meters.
 * Fed by AudioLevels status updates (~10 Hz).
 */

export const LEVEL_HISTORY_CAPACITY = 100 // ~10 s at 10 Hz

export type MeterChannel = 'microphone' | 'playback' | 'output'

export interface PeakHoldState {
  readonly current: number
  readonly held: number
}

export interface PeakHoldSnapshot {
  readonly microphone: PeakHoldState
  readonly playback: PeakHoldState
  readonly output: PeakHoldState
}

export function createEmptyPeakHold(): PeakHoldSnapshot {
  return {
    microphone: { current: 0, held: 0 },
    playback: { current: 0, held: 0 },
    output: { current: 0, held: 0 }
  }
}

export function updatePeakHold(
  previous: PeakHoldSnapshot,
  peaks: { microphone: number; playback: number; output: number },
  enabled: boolean
): PeakHoldSnapshot {
  if (!enabled) {
    return {
      microphone: { current: peaks.microphone, held: peaks.microphone },
      playback: { current: peaks.playback, held: peaks.playback },
      output: { current: peaks.output, held: peaks.output }
    }
  }

  return {
    microphone: {
      current: peaks.microphone,
      held: Math.max(previous.microphone.held, peaks.microphone)
    },
    playback: {
      current: peaks.playback,
      held: Math.max(previous.playback.held, peaks.playback)
    },
    output: {
      current: peaks.output,
      held: Math.max(previous.output.held, peaks.output)
    }
  }
}

export function resetPeakHold(peaks: {
  microphone: number
  playback: number
  output: number
}): PeakHoldSnapshot {
  return {
    microphone: { current: peaks.microphone, held: peaks.microphone },
    playback: { current: peaks.playback, held: peaks.playback },
    output: { current: peaks.output, held: peaks.output }
  }
}

/** Fixed-capacity ring of peak samples for sparkline history. */
export class LevelHistoryBuffer {
  private readonly capacity: number
  private readonly samples: number[]
  private writeIndex = 0
  private count = 0

  constructor(capacity: number = LEVEL_HISTORY_CAPACITY) {
    this.capacity = Math.max(1, capacity)
    this.samples = new Array<number>(this.capacity).fill(0)
  }

  push(peak: number): void {
    const value = Number.isFinite(peak) ? Math.max(0, peak) : 0
    this.samples[this.writeIndex] = value
    this.writeIndex = (this.writeIndex + 1) % this.capacity
    if (this.count < this.capacity) {
      this.count++
    }
  }

  clear(): void {
    this.writeIndex = 0
    this.count = 0
    this.samples.fill(0)
  }

  /** Chronological order (oldest → newest). */
  toArray(): number[] {
    if (this.count === 0) {
      return []
    }

    const result = new Array<number>(this.count)
    const start =
      this.count < this.capacity ? 0 : this.writeIndex
    for (let i = 0; i < this.count; i++) {
      result[i] = this.samples[(start + i) % this.capacity]!
    }
    return result
  }

  get length(): number {
    return this.count
  }
}
