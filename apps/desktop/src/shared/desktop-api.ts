/**
 * Local Electron renderer↔main preload bridge contract.
 * Sidecar IPC protocol contracts live in @zoom-dialer/shared-protocol.
 */
import type { Phrase, PhraseImportResult, PhraseReorderDirection } from './phrase'
import type { PlaybackMode } from './playback'
import type { PendingRecording, SaveRecordedPhraseRequest } from './recording'
import type { SettingsStatusSnapshot } from './settings'
import type { SidecarStatusSnapshot } from './sidecar-status'
import type { CreateTtsPhraseRequest, PreviewTtsRequest, TtsVoice } from './tts'

export interface DesktopApi {
  readonly version: string
  readonly sidecar: {
    getStatus(): Promise<SidecarStatusSnapshot>
    runProbes(): Promise<SidecarStatusSnapshot>
    onStatusChanged(listener: (status: SidecarStatusSnapshot) => void): () => void
    selectWavFile(): Promise<string | null>
    playAudio(volume?: number): Promise<SidecarStatusSnapshot>
    stopPlayback(): Promise<SidecarStatusSnapshot>
    getAudioOutputDevices(): Promise<SidecarStatusSnapshot>
    setOutputDevice(deviceId: string): Promise<SidecarStatusSnapshot>
    getAudioInputDevices(): Promise<SidecarStatusSnapshot>
    setMicrophone(deviceId: string): Promise<SidecarStatusSnapshot>
    startMicrophone(): Promise<SidecarStatusSnapshot>
    stopMicrophone(): Promise<SidecarStatusSnapshot>
    setMixerGains(
      microphoneGain: number,
      playbackGain: number,
      masterGain?: number
    ): Promise<SidecarStatusSnapshot>
    playTestTone(options: {
      kind: 'sine' | 'pink' | 'white'
      frequencyHz?: number
      volume: number
      durationMs?: number
    }): Promise<SidecarStatusSnapshot>
  }
  readonly phrases: {
    list(): Promise<Phrase[]>
    importWavs(): Promise<PhraseImportResult>
    remove(phraseId: string): Promise<Phrase[]>
    rename(phraseId: string, name: string): Promise<Phrase>
    setEnabled(phraseId: string, enabled: boolean): Promise<Phrase>
    setCategory(phraseId: string, category: string | null): Promise<Phrase>
    reorder(phraseId: string, direction: PhraseReorderDirection): Promise<Phrase[]>
    play(phraseId: string, volume?: number): Promise<SidecarStatusSnapshot>
    setShortcut(phraseId: string, shortcut: string | null): Promise<Phrase>
  }
  readonly playback: {
    setMode(mode: PlaybackMode): Promise<SidecarStatusSnapshot>
    clearQueue(): Promise<SidecarStatusSnapshot>
    removeQueued(phraseId: string): Promise<SidecarStatusSnapshot>
    skip(): Promise<SidecarStatusSnapshot>
  }
  readonly settings: {
    getStatus(): Promise<SettingsStatusSnapshot>
    exportFile(): Promise<string | null>
    importFile(): Promise<SettingsStatusSnapshot>
    reset(): Promise<SettingsStatusSnapshot>
    setCategoryFilter(categoryFilter: string): Promise<SettingsStatusSnapshot>
    setCalibration(prefs: {
      showRms: boolean
      peakHoldEnabled: boolean
      historyEnabled: boolean
    }): Promise<SettingsStatusSnapshot>
  }
  readonly tts: {
    listVoices(): Promise<readonly TtsVoice[]>
    preview(request: PreviewTtsRequest): Promise<SidecarStatusSnapshot>
    create(request: CreateTtsPhraseRequest): Promise<Phrase>
  }
  readonly recording: {
    start(): Promise<{ readonly id: string; readonly startedAtMs: number }>
    stop(): Promise<PendingRecording>
    cancel(): Promise<void>
    save(request: SaveRecordedPhraseRequest): Promise<Phrase>
    discard(): Promise<void>
  }
}

export const DESKTOP_API_VERSION = '0.1.0' as const
