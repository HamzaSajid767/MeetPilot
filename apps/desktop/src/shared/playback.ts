export type PlaybackMode = 'interrupt' | 'queue' | 'ignore'

export type PlayOutcome = 'started' | 'queued' | 'busy'

export interface QueuedPhraseSnapshot {
  readonly phraseId: string
  readonly name: string
}

export interface PlayRequestPhrase {
  readonly id: string
  readonly name: string
  readonly filePath: string
}

export const PLAYBACK_IPC_CHANNELS = Object.freeze({
  setMode: 'playback:set-mode',
  clearQueue: 'playback:clear-queue',
  removeQueued: 'playback:remove-queued',
  skip: 'playback:skip'
} as const)

export const PLAYBACK_MODES: readonly PlaybackMode[] = Object.freeze([
  'interrupt',
  'queue',
  'ignore'
])

export function isPlaybackMode(value: unknown): value is PlaybackMode {
  return value === 'interrupt' || value === 'queue' || value === 'ignore'
}
