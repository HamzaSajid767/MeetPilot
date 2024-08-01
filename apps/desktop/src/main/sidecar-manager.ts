import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { app } from 'electron'
import type {
  ApplicationStateDto,
  AudioInputDeviceListDto,
  AudioOutputDeviceListDto,
  SetMixerGainsResultDto,
  SetMicrophoneResultDto,
  SetOutputDeviceResultDto,
  VersionInfoDto
} from '@zoom-dialer/shared-protocol'
import { PROTOCOL_VERSION } from '../shared/protocol'
import {
  createInitialSidecarStatus,
  deriveVirtualRoutingFields,
  type AudioInputDeviceSnapshot,
  type AudioOutputDeviceSnapshot,
  type SidecarProbeResult,
  type SidecarStatusSnapshot
} from '../shared/sidecar-status'
import type { Phrase } from '../shared/phrase'
import type { Logger } from './logger'
import { extractSuccessData, PipeClient } from './ipc/pipe-client'
import type { PhraseLibrary } from './phrase-library'
import { PlaybackController } from './playback-controller'
import type { PlaybackMode } from '../shared/playback'
import type { PersistedAudioSettings, SettingsSaveState } from '../shared/settings'
import {
  clampTtsRate,
  clampTtsVolume,
  validateTtsName,
  validateTtsText,
  type CreateTtsPhraseRequest,
  type PreviewTtsRequest,
  type TtsVoice
} from '../shared/tts'
import {
  assertRecordingDuration,
  normalizeRecordingCategory,
  validateRecordingName,
  type PendingRecording,
  type SaveRecordedPhraseRequest
} from '../shared/recording'

const MAX_RESTART_ATTEMPTS = 8
const BASE_RECONNECT_DELAY_MS = 250
const MAX_RECONNECT_DELAY_MS = 5_000
const TTS_REQUEST_TIMEOUT_MS = 60_000
const RECORDING_REQUEST_TIMEOUT_MS = 120_000

export interface SidecarManagerPaths {
  readonly assetsDirectory: string
  readonly tempDirectory: string
}

interface ActiveRecordingSession {
  readonly id: string
  readonly path: string
  readonly startedAtMs: number
  readonly startedMicForMetering: boolean
}

interface StoppedRecordingSession {
  readonly id: string
  readonly path: string
  readonly durationMs: number
}

export class SidecarManager extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null
  private client: PipeClient | null = null
  private pipeName: string | null = null
  private status: SidecarStatusSnapshot = createInitialSidecarStatus()
  private stopping = false
  private connectLoop: Promise<void> | null = null
  private restartCount = 0
  private readonly playback = new PlaybackController()
  private advancingQueue = false
  private pendingAudioPrefs: PersistedAudioSettings | null = null
  private configChangedHandler: (() => void) | null = null
  private readonly assetsDirectory: string
  private readonly tempDirectory: string
  private activeRecording: ActiveRecordingSession | null = null
  private stoppedRecording: StoppedRecordingSession | null = null

  constructor(
    private readonly logger: Logger,
    private readonly phraseLibrary: PhraseLibrary,
    paths?: SidecarManagerPaths
  ) {
    super()
    this.assetsDirectory = paths?.assetsDirectory ?? ''
    this.tempDirectory = paths?.tempDirectory ?? ''
    this.updateStatus({ phrases: this.phraseLibrary.list(), ...this.queueStatusPatch() })
    this.phraseLibrary.on('change', (phrases: import('../shared/phrase').Phrase[]) => {
      this.updateStatus({ phrases })
      this.notifyConfigChanged()
    })
  }

  setConfigChangedHandler(handler: (() => void) | null): void {
    this.configChangedHandler = handler
  }

  /**
   * Apply persisted audio prefs to status before sidecar connect.
   * Devices are re-applied to the sidecar after the first device refresh.
   */
  applyPersistedAudioPrefs(audio: PersistedAudioSettings): void {
    this.pendingAudioPrefs = { ...audio }
    this.updateStatus({
      selectedOutputDeviceId: audio.selectedOutputDeviceId,
      selectedInputDeviceId: audio.selectedInputDeviceId,
      microphoneGain: audio.microphoneGain,
      playbackGain: audio.playbackGain,
      masterGain: audio.masterGain
    })
  }

  applyPersistedCalibrationPrefs(
    calibration: import('../shared/settings').PersistedCalibrationSettings
  ): void {
    this.updateStatus({
      calibrationShowRms: calibration.showRms,
      calibrationPeakHoldEnabled: calibration.peakHoldEnabled,
      calibrationHistoryEnabled: calibration.historyEnabled
    })
  }

  setSettingsUiFields(fields: {
    settingsSaveState: SettingsSaveState
    settingsLastSavedAtMs: number | null
    categoryFilter: string
  }): void {
    this.updateStatus(fields)
  }

  private notifyConfigChanged(): void {
    this.configChangedHandler?.()
  }

  getStatus(): SidecarStatusSnapshot {
    return this.status
  }

  setHotkeyBindings(bindings: readonly import('../shared/phrase').HotkeyBindingStatus[]): void {
    this.updateStatus({ hotkeyBindings: [...bindings] })
  }

  async getAvailableVoices(): Promise<readonly TtsVoice[]> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    const response = await this.client.request('GetAvailableVoices', {})
    const data = extractSuccessData<{
      voices?: Array<{
        id?: string
        displayName?: string
        language?: string
        gender?: string | null
      }>
    }>(response)

    return (data.voices ?? [])
      .filter((voice) => typeof voice.id === 'string' && voice.id.trim() !== '')
      .map((voice) => ({
        id: voice.id!,
        displayName: voice.displayName?.trim() || voice.id!,
        language: voice.language ?? '',
        gender: voice.gender ?? null
      }))
  }

  async previewTts(request: PreviewTtsRequest): Promise<SidecarStatusSnapshot> {
    const text = validateTtsText(request.text)
    const rate = clampTtsRate(request.rate)
    const volume = clampTtsVolume(request.volume)

    if (!this.tempDirectory) {
      throw new Error('Temporary directory is not configured')
    }

    await mkdir(this.tempDirectory, { recursive: true })
    const outputPath = path.join(this.tempDirectory, 'tts-preview.wav')
    await this.synthesizeSpeechToFile({
      text,
      voiceId: request.voiceId,
      rate,
      volume,
      outputPath
    })

    return this.playAudio(outputPath, volume)
  }

  async createTtsPhrase(request: CreateTtsPhraseRequest): Promise<Phrase> {
    const name = validateTtsName(request.name)
    const text = validateTtsText(request.text)
    const rate = clampTtsRate(request.rate)
    const volume = clampTtsVolume(request.volume)

    if (!this.assetsDirectory) {
      throw new Error('Assets directory is not configured')
    }

    const phraseId = randomUUID().replaceAll('-', '')
    const ttsDir = path.join(this.assetsDirectory, 'tts')
    await mkdir(ttsDir, { recursive: true })
    const outputPath = path.join(ttsDir, `${phraseId}.wav`)

    const synthesized = await this.synthesizeSpeechToFile({
      text,
      voiceId: request.voiceId,
      rate,
      volume,
      outputPath
    })

    const phrase = this.phraseLibrary.addGeneratedPhrase({
      id: phraseId,
      name,
      filePath: synthesized.path,
      durationMs: synthesized.durationMs,
      category: 'TTS'
    })

    this.updateStatus({
      lastResponse: `Created TTS phrase "${phrase.name}"`,
      phrases: this.phraseLibrary.list()
    })
    return phrase
  }

  async startPhraseRecording(): Promise<{ readonly id: string; readonly startedAtMs: number }> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }
    if (!this.assetsDirectory) {
      throw new Error('Assets directory is not configured')
    }
    if (this.activeRecording || this.stoppedRecording) {
      throw new Error('A recording is already in progress or waiting to be saved')
    }

    const phraseId = randomUUID().replaceAll('-', '')
    const recordingsDir = path.join(this.assetsDirectory, 'recordings')
    await mkdir(recordingsDir, { recursive: true })
    const outputPath = path.join(recordingsDir, `${phraseId}.wav`)

    const startedMicForMetering = !this.status.microphoneActive
    if (startedMicForMetering) {
      try {
        await this.startMicrophone()
      } catch (error) {
        // Metering is best-effort; recording still proceeds.
        this.logger.warn(
          'Could not start microphone for recording meter',
          {
            error: error instanceof Error ? error.message : String(error)
          },
          'recording.meter_start_failed'
        )
      }
    }

    try {
      const response = await this.client.request(
        'StartRecording',
        {
          outputPath,
          deviceId: this.status.selectedInputDeviceId
        },
        randomUUID().replaceAll('-', ''),
        RECORDING_REQUEST_TIMEOUT_MS
      )
      extractSuccessData<{ succeeded?: boolean }>(response)
    } catch (error) {
      if (startedMicForMetering && this.status.microphoneActive) {
        try {
          await this.stopMicrophone()
        } catch {
          // ignore
        }
      }
      throw error
    }

    const startedAtMs = Date.now()
    this.activeRecording = {
      id: phraseId,
      path: outputPath,
      startedAtMs,
      startedMicForMetering
    }
    this.updateStatus({ lastResponse: 'Recording started', lastError: null })
    return { id: phraseId, startedAtMs }
  }

  async stopPhraseRecording(): Promise<PendingRecording> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }
    if (!this.activeRecording) {
      throw new Error('No recording is in progress')
    }

    const session = this.activeRecording
    try {
      const response = await this.client.request(
        'StopRecording',
        {},
        randomUUID().replaceAll('-', ''),
        RECORDING_REQUEST_TIMEOUT_MS
      )
      const data = extractSuccessData<{
        path?: string
        durationMs?: number
        succeeded?: boolean
      }>(response)

      if (data.succeeded === false || !data.path) {
        throw new Error('Stop recording failed')
      }

      const durationMs = typeof data.durationMs === 'number' ? data.durationMs : 0
      this.stoppedRecording = {
        id: session.id,
        path: data.path,
        durationMs
      }
      this.activeRecording = null
      this.updateStatus({
        lastResponse: `Recording stopped (${durationMs} ms)`,
        lastError: null
      })
      return {
        id: session.id,
        path: data.path,
        durationMs
      }
    } catch (error) {
      this.activeRecording = null
      this.stoppedRecording = null
      await this.tryDeleteFile(session.path)
      throw error
    } finally {
      await this.restoreMicAfterRecording(session.startedMicForMetering)
    }
  }

  async cancelPhraseRecording(): Promise<void> {
    const session = this.activeRecording
    const stopped = this.stoppedRecording
    this.activeRecording = null
    this.stoppedRecording = null

    if (this.client && this.client.getState() === 'connected' && session) {
      try {
        await this.client.request(
          'CancelRecording',
          {},
          randomUUID().replaceAll('-', ''),
          RECORDING_REQUEST_TIMEOUT_MS
        )
      } catch (error) {
        this.logger.warn(
          'CancelRecording request failed',
          {
            error: error instanceof Error ? error.message : String(error)
          },
          'recording.cancel_failed'
        )
      }
    }

    if (session) {
      await this.tryDeleteFile(session.path)
      await this.restoreMicAfterRecording(session.startedMicForMetering)
    }
    if (stopped) {
      await this.tryDeleteFile(stopped.path)
    }

    this.updateStatus({ lastResponse: 'Recording cancelled', lastError: null })
  }

  async saveRecordedPhrase(request: SaveRecordedPhraseRequest): Promise<Phrase> {
    if (!this.stoppedRecording) {
      throw new Error('No stopped recording available to save')
    }

    const name = validateRecordingName(request.name)
    const category = normalizeRecordingCategory(request.category)
    assertRecordingDuration(this.stoppedRecording.durationMs)

    const pending = this.stoppedRecording
    this.stoppedRecording = null

    const phrase = this.phraseLibrary.addGeneratedPhrase({
      id: pending.id,
      name,
      filePath: pending.path,
      durationMs: pending.durationMs,
      category
    })

    this.updateStatus({
      lastResponse: `Saved recorded phrase "${phrase.name}"`,
      phrases: this.phraseLibrary.list()
    })
    return phrase
  }

  async discardRecordedPhrase(): Promise<void> {
    if (this.activeRecording) {
      await this.cancelPhraseRecording()
      return
    }

    const pending = this.stoppedRecording
    this.stoppedRecording = null
    if (pending) {
      await this.tryDeleteFile(pending.path)
    }
    this.updateStatus({ lastResponse: 'Recording discarded', lastError: null })
  }

  private async restoreMicAfterRecording(startedMicForMetering: boolean): Promise<void> {
    if (!startedMicForMetering || !this.status.microphoneActive) {
      return
    }
    try {
      await this.stopMicrophone()
    } catch {
      // Best-effort restore.
    }
  }

  private async tryDeleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath)
    } catch {
      // ignore missing/locked files
    }
  }

  private async synthesizeSpeechToFile(input: {
    text: string
    voiceId: string | null
    rate: number
    volume: number
    outputPath: string
  }): Promise<{ path: string; durationMs: number }> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    const response = await this.client.request(
      'SynthesizeSpeech',
      {
        text: input.text,
        voiceId: input.voiceId,
        rate: input.rate,
        volume: input.volume,
        outputPath: input.outputPath
      },
      randomUUID().replaceAll('-', ''),
      TTS_REQUEST_TIMEOUT_MS
    )

    const data = extractSuccessData<{ path?: string; durationMs?: number; succeeded?: boolean }>(
      response
    )
    if (data.succeeded === false || !data.path) {
      throw new Error('Speech synthesis failed')
    }

    return {
      path: data.path,
      durationMs: typeof data.durationMs === 'number' ? data.durationMs : 0
    }
  }

  async start(): Promise<void> {
    this.stopping = false
    this.updateStatus({ connectionState: 'starting', lastError: null })
    this.connectLoop ??= this.runConnectLoop()
  }

  async stop(): Promise<void> {
    this.stopping = true
    this.client?.disconnect()
    this.client = null

    const child = this.child
    this.child = null
    if (child && !child.killed) {
      child.kill()
      await waitForExit(child, 3_000)
    }

    this.updateStatus({
      connectionState: 'stopped',
      lastError: null
    })
  }

  async runProbes(): Promise<readonly SidecarProbeResult[]> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    const probes: SidecarProbeResult[] = []

    const pingStarted = Date.now()
    const pingResponse = await this.client.request('Ping', { nonce: `ping-${Date.now()}` })
    const pingData = extractSuccessData<{ nonce: string }>(pingResponse)
    probes.push({
      command: 'Ping',
      ok: true,
      latencyMs: Date.now() - pingStarted,
      summary: `Pong nonce=${pingData.nonce}`,
      raw: pingResponse.payload
    })

    const versionStarted = Date.now()
    const versionResponse = await this.client.request('GetVersion', {})
    const versionData = extractSuccessData<VersionInfoDto>(versionResponse)
    probes.push({
      command: 'GetVersion',
      ok: true,
      latencyMs: Date.now() - versionStarted,
      summary: `VersionInfo protocol=${versionData.protocolVersion} app=${versionData.applicationVersion}`,
      raw: versionResponse.payload
    })

    const healthStarted = Date.now()
    const healthResponse = await this.client.request('HealthCheck', {})
    const healthData = extractSuccessData<ApplicationStateDto>(healthResponse)
    const healthLabel = healthData.isHealthy ? 'Healthy' : 'Unhealthy'
    probes.push({
      command: 'HealthCheck',
      ok: healthData.isHealthy,
      latencyMs: Date.now() - healthStarted,
      summary: healthLabel,
      raw: healthResponse.payload
    })

    const last = probes.at(-1)
    this.updateStatus({
      connectionState: 'connected',
      protocolVersion: versionData.protocolVersion ?? PROTOCOL_VERSION,
      sidecarVersion: versionData.applicationVersion,
      healthLabel,
      lastResponse: last?.summary ?? null,
      lastLatencyMs: last?.latencyMs ?? null,
      lastError: null,
      probes
    })

    this.logger.info(
      'Sidecar probes completed',
      {
        protocolVersion: versionData.protocolVersion,
        sidecarVersion: versionData.applicationVersion,
        healthLabel,
        probeCount: probes.length,
        lastLatencyMs: last?.latencyMs ?? null
      },
      'sidecar.probes_completed'
    )

    return probes
  }

  setSelectedWavPath(filePath: string | null): void {
    this.updateStatus({
      selectedWavPath: filePath,
      playbackError: null
    })
  }

  async getAudioOutputDevices(): Promise<SidecarStatusSnapshot> {
    await this.refreshOutputDevices()
    return this.status
  }

  async setOutputDevice(deviceId: string): Promise<SidecarStatusSnapshot> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    if (!deviceId.trim()) {
      throw new Error('Output device id is required')
    }

    const response = await this.client.request('SetOutputDevice', { deviceId })
    const payload = response.payload as {
      ok?: boolean
      code?: string
      message?: string
      data?: SetOutputDeviceResultDto
    } | null

    if (!payload || payload.ok !== true) {
      const message = payload?.message ?? 'SetOutputDevice was rejected'
      this.updateStatus({
        lastError: message,
        lastResponse: `SetOutputDevice error: ${message}`
      })
      throw new Error(message)
    }

    this.updateStatus({
      selectedOutputDeviceId: payload.data?.deviceId ?? deviceId,
      outputDeviceWarning: null,
      lastResponse: `Output device set to ${payload.data?.friendlyName ?? payload.data?.deviceId ?? deviceId}`,
      lastError: null
    })
    if (this.pendingAudioPrefs) {
      this.pendingAudioPrefs = {
        ...this.pendingAudioPrefs,
        selectedOutputDeviceId: payload.data?.deviceId ?? deviceId
      }
    }
    this.notifyConfigChanged()
    return this.status
  }

  async playAudio(filePath: string, volume = 1): Promise<SidecarStatusSnapshot> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0.0 and 1.0')
    }

    this.updateStatus({
      selectedWavPath: filePath,
      playbackState: 'playing',
      playbackError: null,
      lastPlaybackEvent: 'PlayAudio requested'
    })

    try {
      const response = await this.client.request('PlayAudio', { path: filePath, volume })
      const payload = response.payload as {
        ok?: boolean
        code?: string
        message?: string
        data?: {
          phraseId?: string
          durationMs?: number | null
          succeeded?: boolean
          outputDeviceId?: string | null
          outputDeviceName?: string | null
          usedFallbackDevice?: boolean | null
          fallbackReason?: string | null
        }
      } | null

      if (!payload || payload.ok !== true) {
        const message = payload?.message ?? 'PlayAudio was rejected'
        this.updateStatus({
          playbackState: 'failed',
          playbackError: message,
          lastPlaybackEvent: `PlayAudio error: ${message}`,
          lastError: message,
          playbackStartedAtMs: null
        })
        throw new Error(message)
      }

      const usedFallback = payload.data?.usedFallbackDevice === true
      const fallbackReason = payload.data?.fallbackReason ?? null
      this.updateStatus({
        playbackId: payload.data?.phraseId ?? null,
        playbackDurationMs: payload.data?.durationMs ?? null,
        playbackState: 'playing',
        playbackStartedAtMs: Date.now(),
        mixerRunning: true,
        playbackOutputDeviceId: payload.data?.outputDeviceId ?? null,
        playbackOutputDeviceName: payload.data?.outputDeviceName ?? null,
        selectedOutputDeviceId: usedFallback
          ? null
          : (this.status.selectedOutputDeviceId ?? payload.data?.outputDeviceId ?? null),
        outputDeviceWarning: usedFallback
          ? (fallbackReason ?? 'Selected output device unavailable; using system default.')
          : null,
        lastResponse: `PlayAudio accepted id=${payload.data?.phraseId ?? '?'}`,
        lastPlaybackEvent: usedFallback
          ? `PlayAudio accepted (fallback: ${fallbackReason ?? 'default device'})`
          : 'PlayAudio accepted',
        playbackError: null
      })
      return this.status
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.updateStatus({
        playbackState: 'failed',
        playbackError: message,
        lastPlaybackEvent: `PlayAudio failed: ${message}`,
        lastError: message,
        playbackStartedAtMs: null
      })
      throw error
    }
  }

  async playPhrase(phraseId: string, volume = 1): Promise<SidecarStatusSnapshot> {
    if (!phraseId.trim()) {
      throw new Error('Phrase id is required')
    }

    const phrase = this.phraseLibrary.get(phraseId)
    if (!phrase) {
      throw new Error(`Phrase not found: ${phraseId}`)
    }

    if (!phrase.enabled) {
      throw new Error(`Phrase is disabled: ${phrase.name}`)
    }

    const decision = this.playback.requestPlay(
      { id: phrase.id, name: phrase.name, filePath: phrase.filePath },
      volume
    )

    if (decision.outcome === 'busy') {
      this.updateStatus({
        lastPlayOutcome: 'busy',
        lastPlaybackEvent: `Busy: ignored "${phrase.name}"`,
        lastResponse: 'Playback busy (ignore mode)',
        ...this.queueStatusPatch()
      })
      return this.status
    }

    if (decision.outcome === 'queued') {
      this.updateStatus({
        lastPlayOutcome: 'queued',
        lastPlaybackEvent: `Queued "${phrase.name}"`,
        lastResponse: `Queued "${phrase.name}" (${this.playback.getSnapshot().queueLength} in queue)`,
        ...this.queueStatusPatch()
      })
      return this.status
    }

    return this.startPhrasePlayback(phrase.id, phrase.name, phrase.filePath, decision.volume)
  }

  setPlaybackMode(mode: PlaybackMode): SidecarStatusSnapshot {
    this.playback.setMode(mode)
    this.updateStatus({
      lastResponse: `Playback mode: ${mode}`,
      ...this.queueStatusPatch()
    })
    this.notifyConfigChanged()
    return this.status
  }

  clearPlaybackQueue(): SidecarStatusSnapshot {
    this.playback.clearQueue()
    this.updateStatus({
      lastResponse: 'Playback queue cleared',
      ...this.queueStatusPatch()
    })
    return this.status
  }

  removeQueuedPhrase(phraseId: string): SidecarStatusSnapshot {
    this.playback.removeFromQueue(phraseId)
    this.updateStatus({
      lastResponse: `Removed queued phrase ${phraseId}`,
      ...this.queueStatusPatch()
    })
    return this.status
  }

  async skipCurrentPhrase(): Promise<SidecarStatusSnapshot> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    const next = this.playback.beginSkip()
    this.updateStatus({ playbackState: 'stopping', lastPlaybackEvent: 'Skip requested' })
    await this.client.request('StopPlayback', {})

    if (!next) {
      this.updateStatus({
        playbackState: 'idle',
        playingPhraseId: null,
        playingPhraseName: null,
        playbackStartedAtMs: null,
        mixerRunning: this.status.microphoneActive,
        lastPlaybackEvent: 'Skip: nothing next',
        lastResponse: 'Skipped; queue empty',
        lastPlayOutcome: null,
        ...this.queueStatusPatch()
      })
      return this.status
    }

    return this.startPhrasePlayback(
      next.phrase.id,
      next.phrase.name,
      next.phrase.filePath,
      next.volume
    )
  }

  async stopPlayback(): Promise<SidecarStatusSnapshot> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    this.playback.onUserStop()
    this.updateStatus({ playbackState: 'stopping', lastPlaybackEvent: 'StopPlayback requested' })
    await this.client.request('StopPlayback', {})
    this.updateStatus({
      playbackState: 'idle',
      lastResponse: 'StopPlayback accepted',
      lastPlaybackEvent: 'StopPlayback accepted',
      mixerRunning: this.status.microphoneActive,
      playingPhraseId: null,
      playingPhraseName: null,
      playbackStartedAtMs: null,
      lastPlayOutcome: null,
      ...this.queueStatusPatch()
    })
    return this.status
  }

  private async startPhrasePlayback(
    phraseId: string,
    phraseName: string,
    filePath: string,
    volume: number
  ): Promise<SidecarStatusSnapshot> {
    this.updateStatus({
      playingPhraseId: phraseId,
      playingPhraseName: phraseName,
      selectedWavPath: filePath,
      lastPlayOutcome: 'started',
      ...this.queueStatusPatch()
    })

    try {
      const result = await this.playAudio(filePath, volume)
      this.playback.markStarted(result.playbackId)
      this.updateStatus({ ...this.queueStatusPatch() })
      return this.status
    } catch (error) {
      this.playback.onStartFailed()
      this.updateStatus({
        playingPhraseId: null,
        playingPhraseName: null,
        playbackStartedAtMs: null,
        lastPlayOutcome: null,
        ...this.queueStatusPatch()
      })
      throw error
    }
  }

  private queueStatusPatch(): Partial<SidecarStatusSnapshot> {
    const snap = this.playback.getSnapshot()
    return {
      playbackMode: snap.mode,
      playbackQueue: snap.queue,
      queueLength: snap.queueLength,
      nextPhraseId: snap.nextPhraseId,
      nextPhraseName: snap.nextPhraseName,
      playingPhraseId: snap.activePhraseId,
      playingPhraseName: snap.activePhraseName
    }
  }

  private advanceAfterPlaybackEnded(playbackId: string | null): void {
    if (this.advancingQueue) {
      return
    }

    const next = this.playback.onPlaybackEnded(playbackId)
    this.updateStatus({
      playbackState: 'idle',
      playbackId: playbackId ?? this.status.playbackId,
      mixerRunning: this.status.microphoneActive,
      playingPhraseId: null,
      playingPhraseName: null,
      playbackStartedAtMs: null,
      ...this.queueStatusPatch()
    })

    if (!next) {
      return
    }

    this.advancingQueue = true
    void this.startPhrasePlayback(next.phrase.id, next.phrase.name, next.phrase.filePath, next.volume)
      .catch((error: unknown) => {
        this.logger.warn(
          'Queue advance play failed',
          {
            phraseId: next.phrase.id,
            error: error instanceof Error ? error.message : String(error)
          },
          'playback.queue_advance_failed'
        )
        this.playback.onStartFailed()
        this.advanceAfterPlaybackEnded(null)
      })
      .finally(() => {
        this.advancingQueue = false
      })
  }

  async getAudioInputDevices(): Promise<SidecarStatusSnapshot> {
    await this.refreshInputDevices()
    return this.status
  }

  async setMicrophone(deviceId: string): Promise<SidecarStatusSnapshot> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    if (!deviceId.trim()) {
      throw new Error('Microphone device id is required')
    }

    const response = await this.client.request('SetMicrophone', { deviceId })
    const payload = response.payload as {
      ok?: boolean
      code?: string
      message?: string
      data?: SetMicrophoneResultDto
    } | null

    if (!payload || payload.ok !== true) {
      const message = payload?.message ?? 'SetMicrophone was rejected'
      this.updateStatus({
        lastError: message,
        lastResponse: `SetMicrophone error: ${message}`
      })
      throw new Error(message)
    }

    this.updateStatus({
      selectedInputDeviceId: payload.data?.deviceId ?? deviceId,
      captureDeviceName: payload.data?.friendlyName ?? this.status.captureDeviceName,
      lastResponse: `Microphone set to ${payload.data?.friendlyName ?? payload.data?.deviceId ?? deviceId}`,
      lastError: null,
      microphoneError: null
    })
    if (this.pendingAudioPrefs) {
      this.pendingAudioPrefs = {
        ...this.pendingAudioPrefs,
        selectedInputDeviceId: payload.data?.deviceId ?? deviceId
      }
    }
    this.notifyConfigChanged()
    return this.status
  }

  async startMicrophone(): Promise<SidecarStatusSnapshot> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    this.updateStatus({ microphoneError: null, lastResponse: 'StartMicrophone requested' })
    try {
      const response = await this.client.request('StartMicrophone', {})
      const payload = response.payload as {
        ok?: boolean
        code?: string
        message?: string
      } | null

      if (!payload || payload.ok !== true) {
        const message = payload?.message ?? 'StartMicrophone was rejected'
        this.updateStatus({
          microphoneActive: false,
          microphoneError: message,
          lastError: message,
          lastResponse: `StartMicrophone error: ${message}`
        })
        throw new Error(message)
      }

      this.updateStatus({
        microphoneActive: true,
        mixerRunning: true,
        microphoneError: null,
        lastResponse: 'StartMicrophone accepted',
        lastError: null
      })
      return this.status
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.updateStatus({
        microphoneActive: false,
        microphoneError: message,
        lastError: message,
        lastResponse: `StartMicrophone failed: ${message}`
      })
      throw error
    }
  }

  async stopMicrophone(): Promise<SidecarStatusSnapshot> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    await this.client.request('StopMicrophone', {})
    this.updateStatus({
      microphoneActive: false,
      mixerRunning: this.status.playbackState === 'playing',
      microphonePeak: 0,
      microphoneRms: 0,
      lastResponse: 'StopMicrophone accepted',
      microphoneError: null
    })
    return this.status
  }

  async setMixerGains(
    microphoneGain: number,
    playbackGain: number,
    masterGain: number = this.status.masterGain
  ): Promise<SidecarStatusSnapshot> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    if (
      microphoneGain < 0 ||
      microphoneGain > 1 ||
      playbackGain < 0 ||
      playbackGain > 1 ||
      masterGain < 0 ||
      masterGain > 1
    ) {
      throw new Error('Gains must be between 0.0 and 1.0')
    }

    const response = await this.client.request('SetMixerGains', {
      microphoneGain,
      playbackGain,
      masterGain
    })
    const payload = response.payload as {
      ok?: boolean
      code?: string
      message?: string
      data?: SetMixerGainsResultDto
    } | null

    if (!payload || payload.ok !== true) {
      const message = payload?.message ?? 'SetMixerGains was rejected'
      this.updateStatus({
        lastError: message,
        lastResponse: `SetMixerGains error: ${message}`
      })
      throw new Error(message)
    }

    const nextMic = payload.data?.microphoneGain ?? microphoneGain
    const nextPlay = payload.data?.playbackGain ?? playbackGain
    const nextMaster = payload.data?.masterGain ?? masterGain

    this.updateStatus({
      microphoneGain: nextMic,
      playbackGain: nextPlay,
      masterGain: nextMaster,
      lastResponse: `Mixer gains mic=${nextMic} play=${nextPlay} master=${nextMaster}`,
      lastError: null
    })
    if (this.pendingAudioPrefs) {
      this.pendingAudioPrefs = {
        ...this.pendingAudioPrefs,
        microphoneGain: nextMic,
        playbackGain: nextPlay,
        masterGain: nextMaster
      }
    }
    this.notifyConfigChanged()
    return this.status
  }

  async playTestTone(options: {
    kind: 'sine' | 'pink' | 'white'
    frequencyHz?: number
    volume: number
    durationMs?: number
  }): Promise<SidecarStatusSnapshot> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    if (options.volume < 0 || options.volume > 1) {
      throw new Error('Volume must be between 0.0 and 1.0')
    }

    const response = await this.client.request('PlayTestTone', {
      kind: options.kind,
      volume: options.volume,
      ...(options.frequencyHz != null ? { frequencyHz: options.frequencyHz } : {}),
      ...(options.durationMs != null ? { durationMs: options.durationMs } : {})
    })
    const payload = response.payload as {
      ok?: boolean
      message?: string
      data?: { playbackId?: string; durationMs?: number | null; kind?: string }
    } | null

    if (!payload || payload.ok !== true) {
      const message = payload?.message ?? 'PlayTestTone was rejected'
      this.updateStatus({
        lastError: message,
        lastResponse: `PlayTestTone error: ${message}`,
        playbackError: message
      })
      throw new Error(message)
    }

    this.updateStatus({
      playbackState: 'playing',
      playbackId: payload.data?.playbackId ?? this.status.playbackId,
      playbackDurationMs: payload.data?.durationMs ?? this.status.playbackDurationMs,
      playbackStartedAtMs: Date.now(),
      mixerRunning: true,
      lastResponse: `PlayTestTone kind=${options.kind}`,
      lastError: null,
      playbackError: null
    })
    return this.status
  }

  private handleProtocolEvent(envelope: import('../shared/protocol').MessageEnvelope): void {
    const payload = envelope.payload as Record<string, unknown> | null
    const phraseId = typeof payload?.phraseId === 'string' ? payload.phraseId : null

    if (envelope.type === 'PlaybackStarted') {
      const durationMs =
        typeof payload?.durationMs === 'number'
          ? payload.durationMs
          : this.status.playbackDurationMs
      const playbackId = phraseId ?? this.status.playbackId
      if (playbackId) {
        this.playback.onPlaybackStarted(playbackId, this.status.playingPhraseId)
      }
      this.updateStatus({
        playbackState: 'playing',
        playbackId,
        playbackDurationMs: durationMs,
        playbackStartedAtMs: this.status.playbackStartedAtMs ?? Date.now(),
        mixerRunning: true,
        lastPlaybackEvent: `PlaybackStarted id=${playbackId ?? '?'} durationMs=${durationMs ?? 'n/a'}`,
        playbackError: null,
        ...this.queueStatusPatch()
      })
      return
    }

    if (envelope.type === 'PlaybackCompleted') {
      this.updateStatus({
        lastPlaybackEvent: `PlaybackCompleted id=${phraseId ?? '?'}`,
        playbackError: null
      })
      this.advanceAfterPlaybackEnded(phraseId)
      return
    }

    if (envelope.type === 'PlaybackFailed') {
      const message = typeof payload?.message === 'string' ? payload.message : 'Playback failed'
      this.updateStatus({
        playbackState: 'failed',
        lastPlaybackEvent: `PlaybackFailed id=${phraseId ?? '?'}: ${message}`,
        playbackError: message,
        lastError: message
      })
      this.advanceAfterPlaybackEnded(phraseId)
      return
    }

    if (envelope.type === 'MicrophoneStarted') {
      const deviceId = typeof payload?.deviceId === 'string' ? payload.deviceId : null
      const friendlyName =
        typeof payload?.friendlyName === 'string' ? payload.friendlyName : null
      this.updateStatus({
        microphoneActive: true,
        mixerRunning: true,
        selectedInputDeviceId: deviceId ?? this.status.selectedInputDeviceId,
        captureDeviceName: friendlyName ?? this.status.captureDeviceName,
        microphoneError: null,
        lastResponse: `MicrophoneStarted device=${friendlyName ?? deviceId ?? '?'}`
      })
      return
    }

    if (envelope.type === 'MicrophoneStopped') {
      const reason = typeof payload?.reason === 'string' ? payload.reason : null
      this.updateStatus({
        microphoneActive: false,
        mixerRunning: this.status.playbackState === 'playing',
        microphonePeak: 0,
        microphoneRms: 0,
        lastResponse: `MicrophoneStopped${reason ? `: ${reason}` : ''}`
      })
      return
    }

    if (envelope.type === 'MicrophoneFailed') {
      const message =
        typeof payload?.message === 'string' ? payload.message : 'Microphone failed'
      this.updateStatus({
        microphoneActive: false,
        mixerRunning: this.status.playbackState === 'playing',
        microphoneError: message,
        lastError: message,
        lastResponse: `MicrophoneFailed: ${message}`
      })
      return
    }

    if (envelope.type === 'AudioLevels') {
      const microphonePeak =
        typeof payload?.microphonePeak === 'number' ? payload.microphonePeak : 0
      const microphoneRms =
        typeof payload?.microphoneRms === 'number' ? payload.microphoneRms : 0
      const playbackPeak =
        typeof payload?.playbackPeak === 'number' ? payload.playbackPeak : 0
      const playbackRms = typeof payload?.playbackRms === 'number' ? payload.playbackRms : 0
      const outputPeak = typeof payload?.outputPeak === 'number' ? payload.outputPeak : 0
      const outputRms = typeof payload?.outputRms === 'number' ? payload.outputRms : 0
      const microphoneClipped = payload?.microphoneClipped === true
      const playbackClipped = payload?.playbackClipped === true
      const outputClipped = payload?.outputClipped === true
      this.updateStatus({
        mixerRunning: true,
        microphonePeak,
        microphoneRms,
        playbackPeak,
        playbackRms,
        outputPeak,
        outputRms,
        microphoneClipped,
        playbackClipped,
        outputClipped
      })
    }
  }

  private async runConnectLoop(): Promise<void> {
    let attempt = 0
    while (!this.stopping) {
      try {
        await this.ensureChildRunning()
        this.pipeName ??= createPipeName()
        this.updateStatus({
          connectionState: attempt === 0 ? 'connecting' : 'reconnecting',
          restartCount: this.restartCount
        })

        const client = new PipeClient({
          pipeName: this.pipeName,
          logger: this.logger.child('pipe')
        })
        this.client = client

        client.on('protocolEvent', (envelope) => {
          this.handleProtocolEvent(envelope)
        })

        client.on('disconnected', () => {
          if (!this.stopping) {
            this.updateStatus({ connectionState: 'reconnecting' })
          }
        })

        await client.connect()
        attempt = 0
        this.updateStatus({ connectionState: 'connected', lastError: null })
        await this.runProbes()
        await this.refreshOutputDevices()
        await this.refreshInputDevices()
        await this.applyPendingAudioToSidecar()

        await new Promise<void>((resolve) => {
          client.once('disconnected', () => resolve())
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(
          'Sidecar connect loop iteration failed',
          { error: message },
          'sidecar.connect_failed'
        )
        this.updateStatus({
          connectionState: this.stopping ? 'stopped' : 'reconnecting',
          lastError: message
        })
        attempt += 1
        if (attempt > MAX_RESTART_ATTEMPTS) {
          this.updateStatus({ connectionState: 'faulted', lastError: message })
          break
        }

        const delay = Math.min(
          MAX_RECONNECT_DELAY_MS,
          BASE_RECONNECT_DELAY_MS * 2 ** Math.min(attempt, 4)
        )
        await sleep(delay)
      }
    }

    this.connectLoop = null
  }

  private async ensureChildRunning(): Promise<void> {
    if (this.child && !this.child.killed) {
      return
    }

    this.pipeName = createPipeName()
    const launch = resolveSidecarLaunch(this.pipeName)
    this.logger.info(
      'Spawning sidecar process',
      {
        command: launch.command,
        hasArgs: launch.args.length > 0,
        mode: launch.mode,
        cwd: launch.cwd
      },
      'sidecar.spawn'
    )

    const child = spawn(launch.command, launch.args, {
      cwd: launch.cwd,
      windowsHide: true,
      stdio: 'pipe',
      env: {
        ...process.env,
        DOTNET_ENVIRONMENT: app.isPackaged ? 'Production' : 'Development'
      }
    })
    this.child = child
    this.restartCount += 1

    child.stdout.on('data', (chunk: Buffer) => {
      this.logger.debug(
        'Sidecar stdout',
        { line: chunk.toString('utf8').trimEnd() },
        'sidecar.stdout'
      )
    })
    child.stderr.on('data', (chunk: Buffer) => {
      this.logger.warn(
        'Sidecar stderr',
        { line: chunk.toString('utf8').trimEnd() },
        'sidecar.stderr'
      )
    })
    child.on('exit', (code, signal) => {
      this.logger.warn('Sidecar process exited', { code, signal }, 'sidecar.exited')
      if (this.child === child) {
        this.child = null
      }
      this.client?.disconnect()
    })

    await sleep(500)
  }

  private async applyPendingAudioToSidecar(): Promise<void> {
    const prefs = this.pendingAudioPrefs
    if (!prefs || !this.client || this.client.getState() !== 'connected') {
      return
    }

    const preferredOutput =
      prefs.selectedOutputDeviceId != null &&
      this.status.outputDevices.some((device) => device.id === prefs.selectedOutputDeviceId)
        ? prefs.selectedOutputDeviceId
        : null

    if (preferredOutput) {
      try {
        await this.setOutputDevice(preferredOutput)
      } catch (error) {
        this.logger.warn(
          'Failed to restore output device',
          {
            deviceId: preferredOutput,
            error: error instanceof Error ? error.message : String(error)
          },
          'settings.restore_output_failed'
        )
      }
    }

    const preferredInput =
      prefs.selectedInputDeviceId != null &&
      this.status.inputDevices.some((device) => device.id === prefs.selectedInputDeviceId)
        ? prefs.selectedInputDeviceId
        : null

    if (preferredInput) {
      try {
        await this.setMicrophone(preferredInput)
      } catch (error) {
        this.logger.warn(
          'Failed to restore microphone',
          {
            deviceId: preferredInput,
            error: error instanceof Error ? error.message : String(error)
          },
          'settings.restore_mic_failed'
        )
      }
    }

    try {
      await this.setMixerGains(prefs.microphoneGain, prefs.playbackGain, prefs.masterGain)
    } catch (error) {
      this.logger.warn(
        'Failed to restore mixer gains',
        {
          error: error instanceof Error ? error.message : String(error)
        },
        'settings.restore_gains_failed'
      )
      this.updateStatus({
        microphoneGain: prefs.microphoneGain,
        playbackGain: prefs.playbackGain,
        masterGain: prefs.masterGain
      })
    }
  }

  private async refreshOutputDevices(): Promise<void> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    const response = await this.client.request('GetAudioOutputDevices', {})
    const data = extractSuccessData<AudioOutputDeviceListDto>(response)
    const devices: AudioOutputDeviceSnapshot[] = (data.devices ?? []).map((device) => ({
      id: device.id,
      friendlyName: device.friendlyName,
      isDefault: device.isDefault,
      deviceState: device.deviceState,
      supportsPlayback: device.supportsPlayback,
      isVirtualDevice: device.isVirtualDevice === true
    }))

    const preferredId =
      this.pendingAudioPrefs?.selectedOutputDeviceId ?? this.status.selectedOutputDeviceId
    const selectedStillPresent =
      preferredId != null && devices.some((device) => device.id === preferredId)
    const selectedOutputDeviceId = selectedStillPresent ? preferredId : null

    this.updateStatus({
      outputDevices: devices,
      selectedOutputDeviceId,
      ...deriveVirtualRoutingFields(devices, selectedOutputDeviceId),
      lastResponse: `Output devices: ${devices.length}`,
      lastError: null
    })
  }

  private async refreshInputDevices(): Promise<void> {
    if (!this.client || this.client.getState() !== 'connected') {
      throw new Error('Sidecar is not connected')
    }

    const response = await this.client.request('GetAudioInputDevices', {})
    const data = extractSuccessData<AudioInputDeviceListDto>(response)
    const devices: AudioInputDeviceSnapshot[] = (data.devices ?? []).map((device) => ({
      id: device.id,
      friendlyName: device.friendlyName,
      isDefault: device.isDefault,
      deviceState: device.deviceState,
      supportsCapture: device.supportsCapture,
      isVirtualDevice: device.isVirtualDevice === true
    }))

    const preferredId =
      this.pendingAudioPrefs?.selectedInputDeviceId ?? this.status.selectedInputDeviceId
    const selectedStillPresent =
      preferredId != null && devices.some((device) => device.id === preferredId)
    const selectedInputDeviceId = selectedStillPresent
      ? preferredId
      : (devices.find((device) => device.isDefault)?.id ?? null)

    const selected = selectedInputDeviceId
      ? devices.find((device) => device.id === selectedInputDeviceId)
      : undefined

    this.updateStatus({
      inputDevices: devices,
      selectedInputDeviceId,
      captureDeviceName: selected?.friendlyName ?? this.status.captureDeviceName,
      lastResponse: `Input devices: ${devices.length}`,
      lastError: null
    })
  }

  private updateStatus(patch: Partial<SidecarStatusSnapshot>): void {
    const nextDevices = patch.outputDevices ?? this.status.outputDevices
    const nextSelectedId =
      patch.selectedOutputDeviceId !== undefined
        ? patch.selectedOutputDeviceId
        : this.status.selectedOutputDeviceId
    const virtualFields =
      patch.outputDevices !== undefined || patch.selectedOutputDeviceId !== undefined
        ? deriveVirtualRoutingFields(nextDevices, nextSelectedId)
        : null

    this.status = {
      ...this.status,
      ...patch,
      ...(virtualFields ?? {}),
      restartCount: patch.restartCount ?? this.restartCount
    }
    this.emit('status', this.status)
  }
}

function createPipeName(): string {
  return `ZoomDialerCompanion-${randomBytes(16).toString('hex')}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForExit(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number
): Promise<void> {
  if (child.exitCode !== null) {
    return
  }

  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    sleep(timeoutMs)
  ])
}

export function resolveSidecarLaunch(pipeName: string): {
  command: string
  args: string[]
  mode: 'dotnet-dll' | 'exe'
  cwd: string
} {
  const override = process.env.ZOOM_DIALER_SIDECAR_PATH
  if (override && existsSync(override)) {
    const cwd = path.dirname(override)
    if (override.toLowerCase().endsWith('.dll')) {
      return {
        command: 'dotnet',
        args: [override, '--pipe-name', pipeName],
        mode: 'dotnet-dll',
        cwd
      }
    }

    return { command: override, args: ['--pipe-name', pipeName], mode: 'exe', cwd }
  }

  if (app.isPackaged) {
    const packagedExe = path.join(process.resourcesPath, 'sidecar', 'ZoomDialer.AudioSidecar.exe')
    return {
      command: packagedExe,
      args: ['--pipe-name', pipeName],
      mode: 'exe',
      cwd: path.dirname(packagedExe)
    }
  }

  const candidates = [
    path.resolve(
      app.getAppPath(),
      '../audio-sidecar/src/ZoomDialer.AudioSidecar/bin/Debug/net8.0-windows/ZoomDialer.AudioSidecar.dll'
    ),
    path.resolve(
      __dirname,
      '../../../audio-sidecar/src/ZoomDialer.AudioSidecar/bin/Debug/net8.0-windows/ZoomDialer.AudioSidecar.dll'
    ),
    path.resolve(
      process.cwd(),
      '../audio-sidecar/src/ZoomDialer.AudioSidecar/bin/Debug/net8.0-windows/ZoomDialer.AudioSidecar.dll'
    )
  ]

  const dll = candidates.find((candidate) => existsSync(candidate))
  if (!dll) {
    throw new Error(
      'Unable to locate the audio sidecar DLL. Build the sidecar or set ZOOM_DIALER_SIDECAR_PATH.'
    )
  }

  return {
    command: 'dotnet',
    args: [dll, '--pipe-name', pipeName],
    mode: 'dotnet-dll',
    cwd: path.dirname(dll)
  }
}
