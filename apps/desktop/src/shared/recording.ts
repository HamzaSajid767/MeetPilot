import { validateTtsName } from './tts'

export const RECORDING_MIN_DURATION_MS = 250

export const DEFAULT_RECORDED_CATEGORY = 'Recorded'

export interface PendingRecording {
  readonly id: string
  readonly path: string
  readonly durationMs: number
}

export interface SaveRecordedPhraseRequest {
  readonly name: string
  readonly category?: string | null
}

export const RECORDING_IPC_CHANNELS = Object.freeze({
  start: 'recording:start',
  stop: 'recording:stop',
  cancel: 'recording:cancel',
  save: 'recording:save',
  discard: 'recording:discard'
} as const)

export function validateRecordingName(name: string): string {
  return validateTtsName(name)
}

export function normalizeRecordingCategory(category: string | null | undefined): string {
  if (category == null || category.trim() === '') {
    return DEFAULT_RECORDED_CATEGORY
  }
  return category.trim()
}

export function assertRecordingDuration(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < RECORDING_MIN_DURATION_MS) {
    throw new Error(
      `Recording is too short (${Math.max(0, Math.floor(durationMs))} ms). Minimum is ${RECORDING_MIN_DURATION_MS} ms.`
    )
  }
}
