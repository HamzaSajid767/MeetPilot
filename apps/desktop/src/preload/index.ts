import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { DESKTOP_API_VERSION, type DesktopApi } from '../shared/desktop-api'
import {
  PHRASE_IPC_CHANNELS,
  type Phrase,
  type PhraseImportResult,
  type PhraseReorderDirection
} from '../shared/phrase'
import { PLAYBACK_IPC_CHANNELS, type PlaybackMode } from '../shared/playback'
import {
  SETTINGS_IPC_CHANNELS,
  type SettingsStatusSnapshot
} from '../shared/settings'
import {
  TTS_IPC_CHANNELS,
  type CreateTtsPhraseRequest,
  type PreviewTtsRequest,
  type TtsVoice
} from '../shared/tts'
import {
  RECORDING_IPC_CHANNELS,
  type PendingRecording,
  type SaveRecordedPhraseRequest
} from '../shared/recording'
import { IPC_CHANNELS, type SidecarStatusSnapshot } from '../shared/sidecar-status'

const api: DesktopApi = Object.freeze({
  version: DESKTOP_API_VERSION,
  sidecar: Object.freeze({
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getStatus) as Promise<SidecarStatusSnapshot>,
    runProbes: () => ipcRenderer.invoke(IPC_CHANNELS.runProbes) as Promise<SidecarStatusSnapshot>,
    onStatusChanged: (listener: (status: SidecarStatusSnapshot) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, status: SidecarStatusSnapshot): void => {
        listener(status)
      }
      ipcRenderer.on(IPC_CHANNELS.statusChanged, wrapped)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.statusChanged, wrapped)
      }
    },
    selectWavFile: () => ipcRenderer.invoke(IPC_CHANNELS.selectWav) as Promise<string | null>,
    playAudio: (volume?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.playAudio, volume) as Promise<SidecarStatusSnapshot>,
    stopPlayback: () =>
      ipcRenderer.invoke(IPC_CHANNELS.stopPlayback) as Promise<SidecarStatusSnapshot>,
    getAudioOutputDevices: () =>
      ipcRenderer.invoke(IPC_CHANNELS.getAudioOutputDevices) as Promise<SidecarStatusSnapshot>,
    setOutputDevice: (deviceId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.setOutputDevice, deviceId) as Promise<SidecarStatusSnapshot>,
    getAudioInputDevices: () =>
      ipcRenderer.invoke(IPC_CHANNELS.getAudioInputDevices) as Promise<SidecarStatusSnapshot>,
    setMicrophone: (deviceId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.setMicrophone, deviceId) as Promise<SidecarStatusSnapshot>,
    startMicrophone: () =>
      ipcRenderer.invoke(IPC_CHANNELS.startMicrophone) as Promise<SidecarStatusSnapshot>,
    stopMicrophone: () =>
      ipcRenderer.invoke(IPC_CHANNELS.stopMicrophone) as Promise<SidecarStatusSnapshot>,
    setMixerGains: (microphoneGain: number, playbackGain: number, masterGain?: number) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.setMixerGains,
        microphoneGain,
        playbackGain,
        masterGain
      ) as Promise<SidecarStatusSnapshot>,
    playTestTone: (options: {
      kind: 'sine' | 'pink' | 'white'
      frequencyHz?: number
      volume: number
      durationMs?: number
    }) =>
      ipcRenderer.invoke(IPC_CHANNELS.playTestTone, options) as Promise<SidecarStatusSnapshot>
  }),
  phrases: Object.freeze({
    list: () => ipcRenderer.invoke(PHRASE_IPC_CHANNELS.list) as Promise<Phrase[]>,
    importWavs: () =>
      ipcRenderer.invoke(PHRASE_IPC_CHANNELS.import) as Promise<PhraseImportResult>,
    remove: (phraseId: string) =>
      ipcRenderer.invoke(PHRASE_IPC_CHANNELS.remove, phraseId) as Promise<Phrase[]>,
    rename: (phraseId: string, name: string) =>
      ipcRenderer.invoke(PHRASE_IPC_CHANNELS.rename, phraseId, name) as Promise<Phrase>,
    setEnabled: (phraseId: string, enabled: boolean) =>
      ipcRenderer.invoke(PHRASE_IPC_CHANNELS.setEnabled, phraseId, enabled) as Promise<Phrase>,
    setCategory: (phraseId: string, category: string | null) =>
      ipcRenderer.invoke(
        PHRASE_IPC_CHANNELS.setCategory,
        phraseId,
        category
      ) as Promise<Phrase>,
    reorder: (phraseId: string, direction: PhraseReorderDirection) =>
      ipcRenderer.invoke(PHRASE_IPC_CHANNELS.reorder, phraseId, direction) as Promise<Phrase[]>,
    play: (phraseId: string, volume?: number) =>
      ipcRenderer.invoke(PHRASE_IPC_CHANNELS.play, phraseId, volume) as Promise<SidecarStatusSnapshot>,
    setShortcut: (phraseId: string, shortcut: string | null) =>
      ipcRenderer.invoke(PHRASE_IPC_CHANNELS.setShortcut, phraseId, shortcut) as Promise<Phrase>
  }),
  playback: Object.freeze({
    setMode: (mode: PlaybackMode) =>
      ipcRenderer.invoke(PLAYBACK_IPC_CHANNELS.setMode, mode) as Promise<SidecarStatusSnapshot>,
    clearQueue: () =>
      ipcRenderer.invoke(PLAYBACK_IPC_CHANNELS.clearQueue) as Promise<SidecarStatusSnapshot>,
    removeQueued: (phraseId: string) =>
      ipcRenderer.invoke(
        PLAYBACK_IPC_CHANNELS.removeQueued,
        phraseId
      ) as Promise<SidecarStatusSnapshot>,
    skip: () => ipcRenderer.invoke(PLAYBACK_IPC_CHANNELS.skip) as Promise<SidecarStatusSnapshot>
  }),
  settings: Object.freeze({
    getStatus: () =>
      ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.getStatus) as Promise<SettingsStatusSnapshot>,
    exportFile: () =>
      ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.exportFile) as Promise<string | null>,
    importFile: () =>
      ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.importFile) as Promise<SettingsStatusSnapshot>,
    reset: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.reset) as Promise<SettingsStatusSnapshot>,
    setCategoryFilter: (categoryFilter: string) =>
      ipcRenderer.invoke(
        SETTINGS_IPC_CHANNELS.setCategoryFilter,
        categoryFilter
      ) as Promise<SettingsStatusSnapshot>,
    setCalibration: (prefs: {
      showRms: boolean
      peakHoldEnabled: boolean
      historyEnabled: boolean
    }) =>
      ipcRenderer.invoke(
        SETTINGS_IPC_CHANNELS.setCalibration,
        prefs
      ) as Promise<SettingsStatusSnapshot>
  }),
  tts: Object.freeze({
    listVoices: () =>
      ipcRenderer.invoke(TTS_IPC_CHANNELS.listVoices) as Promise<readonly TtsVoice[]>,
    preview: (request: PreviewTtsRequest) =>
      ipcRenderer.invoke(TTS_IPC_CHANNELS.preview, request) as Promise<SidecarStatusSnapshot>,
    create: (request: CreateTtsPhraseRequest) =>
      ipcRenderer.invoke(TTS_IPC_CHANNELS.create, request) as Promise<Phrase>
  }),
  recording: Object.freeze({
    start: () =>
      ipcRenderer.invoke(RECORDING_IPC_CHANNELS.start) as Promise<{
        readonly id: string
        readonly startedAtMs: number
      }>,
    stop: () => ipcRenderer.invoke(RECORDING_IPC_CHANNELS.stop) as Promise<PendingRecording>,
    cancel: () => ipcRenderer.invoke(RECORDING_IPC_CHANNELS.cancel) as Promise<void>,
    save: (request: SaveRecordedPhraseRequest) =>
      ipcRenderer.invoke(RECORDING_IPC_CHANNELS.save, request) as Promise<Phrase>,
    discard: () => ipcRenderer.invoke(RECORDING_IPC_CHANNELS.discard) as Promise<void>
  })
})

contextBridge.exposeInMainWorld('api', api)
