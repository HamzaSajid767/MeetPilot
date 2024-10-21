import type {
  PlaybackMode,
  PlayOutcome,
  PlayRequestPhrase,
  QueuedPhraseSnapshot
} from '../shared/playback'

export interface QueuedPhrase extends QueuedPhraseSnapshot {
  readonly volume: number
  readonly filePath: string
}

export interface PlayRequestResult {
  readonly outcome: PlayOutcome
  readonly phrase: PlayRequestPhrase
  readonly volume: number
}

export interface PlaybackControllerSnapshot {
  readonly mode: PlaybackMode
  readonly queue: readonly QueuedPhraseSnapshot[]
  readonly queueLength: number
  readonly activePhraseId: string | null
  readonly activePhraseName: string | null
  readonly nextPhraseId: string | null
  readonly nextPhraseName: string | null
  readonly isBusy: boolean
}

/**
 * In-memory playback policy: interrupt (default), queue, or ignore-while-busy.
 * Does not talk to the sidecar — SidecarManager drives audio.
 */
export class PlaybackController {
  private mode: PlaybackMode = 'interrupt'
  private queue: QueuedPhrase[] = []
  private activePhraseId: string | null = null
  private activePhraseName: string | null = null
  private activePlaybackId: string | null = null
  private pendingReplace = false
  private busy = false

  getMode(): PlaybackMode {
    return this.mode
  }

  getSnapshot(): PlaybackControllerSnapshot {
    const next = this.queue[0] ?? null
    return {
      mode: this.mode,
      queue: this.queue.map(({ phraseId, name }) => ({ phraseId, name })),
      queueLength: this.queue.length,
      activePhraseId: this.activePhraseId,
      activePhraseName: this.activePhraseName,
      nextPhraseId: next?.phraseId ?? null,
      nextPhraseName: next?.name ?? null,
      isBusy: this.busy
    }
  }

  setMode(mode: PlaybackMode): PlaybackControllerSnapshot {
    if (this.mode === mode) {
      return this.getSnapshot()
    }

    const leavingQueue = this.mode === 'queue' && mode !== 'queue'
    this.mode = mode
    if (leavingQueue) {
      this.queue = []
    }
    return this.getSnapshot()
  }

  clearQueue(): PlaybackControllerSnapshot {
    this.queue = []
    return this.getSnapshot()
  }

  removeFromQueue(phraseId: string): boolean {
    const before = this.queue.length
    this.queue = this.queue.filter((entry) => entry.phraseId !== phraseId)
    return this.queue.length < before
  }

  removeFromQueueAt(index: number): boolean {
    if (index < 0 || index >= this.queue.length) {
      return false
    }
    this.queue.splice(index, 1)
    return true
  }

  /**
   * Decide whether to start, enqueue, or reject a play request.
   * On `started`, caller must invoke playAudio; then call markStarted / onPlaybackStarted.
   */
  requestPlay(phrase: PlayRequestPhrase, volume = 1): PlayRequestResult {
    const normalizedVolume = Math.min(1, Math.max(0, volume))

    if (!this.busy) {
      this.busy = true
      this.activePhraseId = phrase.id
      this.activePhraseName = phrase.name
      this.activePlaybackId = null
      this.pendingReplace = false
      return { outcome: 'started', phrase, volume: normalizedVolume }
    }

    if (this.mode === 'interrupt') {
      this.pendingReplace = true
      this.activePhraseId = phrase.id
      this.activePhraseName = phrase.name
      this.activePlaybackId = null
      return { outcome: 'started', phrase, volume: normalizedVolume }
    }

    if (this.mode === 'queue') {
      this.queue.push({
        phraseId: phrase.id,
        name: phrase.name,
        volume: normalizedVolume,
        filePath: phrase.filePath
      })
      return { outcome: 'queued', phrase, volume: normalizedVolume }
    }

    // ignore
    return { outcome: 'busy', phrase, volume: normalizedVolume }
  }

  /** Call after PlayAudio is accepted (before or with PlaybackStarted). */
  markStarted(playbackId: string | null): void {
    this.busy = true
    this.activePlaybackId = playbackId
    this.pendingReplace = false
  }

  onPlaybackStarted(playbackId: string, phraseId?: string | null): void {
    this.busy = true
    this.activePlaybackId = playbackId
    if (phraseId) {
      this.activePhraseId = phraseId
    }
    this.pendingReplace = false
  }

  /**
   * Natural completion or failure of the active clip.
   * Returns the next queued play request when queue mode should advance.
   */
  onPlaybackEnded(playbackId: string | null): PlayRequestResult | null {
    if (this.pendingReplace) {
      // Interrupted clip completed while a replacement is in flight — ignore.
      return null
    }

    if (
      playbackId != null &&
      this.activePlaybackId != null &&
      playbackId !== this.activePlaybackId
    ) {
      return null
    }

    this.busy = false
    this.activePhraseId = null
    this.activePhraseName = null
    this.activePlaybackId = null

    return this.dequeueNext()
  }

  /**
   * User stop: abandon queue and clear active state.
   */
  onUserStop(): void {
    this.pendingReplace = false
    this.busy = false
    this.activePhraseId = null
    this.activePhraseName = null
    this.activePlaybackId = null
    this.queue = []
  }

  /**
   * Skip current: clear active, keep queue, return next item if any.
   * Caller stops audio first, then starts the returned request.
   */
  beginSkip(): PlayRequestResult | null {
    this.pendingReplace = false
    this.busy = false
    this.activePhraseId = null
    this.activePhraseName = null
    this.activePlaybackId = null
    return this.dequeueNext()
  }

  /** Mark play failure before audio started (e.g. pipe reject). */
  onStartFailed(): void {
    this.pendingReplace = false
    this.busy = false
    this.activePhraseId = null
    this.activePhraseName = null
    this.activePlaybackId = null
  }

  private dequeueNext(): PlayRequestResult | null {
    if (this.mode !== 'queue' || this.queue.length === 0) {
      return null
    }

    const next = this.queue.shift()!
    this.busy = true
    this.activePhraseId = next.phraseId
    this.activePhraseName = next.name
    this.activePlaybackId = null
    this.pendingReplace = false
    return {
      outcome: 'started',
      phrase: {
        id: next.phraseId,
        name: next.name,
        filePath: next.filePath
      },
      volume: next.volume
    }
  }
}
