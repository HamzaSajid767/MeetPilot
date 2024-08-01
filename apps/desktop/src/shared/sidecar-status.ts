import type { HotkeyBindingStatus, Phrase } from './phrase'
import type {
  PlaybackMode,
  PlayOutcome,
  QueuedPhraseSnapshot
} from './playback'
import type { SettingsSaveState } from './settings'

export type { HotkeyBindingStatus } from './phrase'
export type { PlaybackMode, PlayOutcome, QueuedPhraseSnapshot } from './playback'
export type { SettingsSaveState } from './settings'

export type SidecarConnectionState =
  'stopped' | 'starting' | 'connecting' | 'connected' | 'reconnecting' | 'faulted'

export type PlaybackUiState = 'idle' | 'playing' | 'stopping' | 'failed'

export type AudioOutputDeviceState = 'Active' | 'Disabled' | 'NotPresent' | 'Unplugged'

export type VirtualRoutingStatus =
  | 'no_virtual_device'
  | 'virtual_available'
  | 'virtual_selected'
  | 'physical_selected'

export interface AudioOutputDeviceSnapshot {
  readonly id: string
  readonly friendlyName: string
  readonly isDefault: boolean
  readonly deviceState: AudioOutputDeviceState
  readonly supportsPlayback: boolean
  readonly isVirtualDevice: boolean
}

export interface AudioInputDeviceSnapshot {
  readonly id: string
  readonly friendlyName: string
  readonly isDefault: boolean
  readonly deviceState: AudioOutputDeviceState
  readonly supportsCapture: boolean
  readonly isVirtualDevice: boolean
}

export interface SidecarProbeResult {
  readonly command: 'Ping' | 'GetVersion' | 'HealthCheck'
  readonly ok: boolean
  readonly latencyMs: number
  readonly summary: string
  readonly raw: unknown
}

export interface SidecarStatusSnapshot {
  readonly connectionState: SidecarConnectionState
  readonly protocolVersion: string | null
  readonly sidecarVersion: string | null
  readonly healthLabel: string | null
  readonly lastResponse: string | null
  readonly lastLatencyMs: number | null
  readonly lastError: string | null
  readonly probes: readonly SidecarProbeResult[]
  readonly restartCount: number
  readonly selectedWavPath: string | null
  readonly playbackState: PlaybackUiState
  readonly playbackId: string | null
  readonly playbackDurationMs: number | null
  readonly lastPlaybackEvent: string | null
  readonly playbackError: string | null
  readonly playbackStartedAtMs: number | null
  readonly phrases: readonly Phrase[]
  readonly playingPhraseId: string | null
  readonly playingPhraseName: string | null
  readonly hotkeyBindings: readonly HotkeyBindingStatus[]
  readonly playbackMode: PlaybackMode
  readonly playbackQueue: readonly QueuedPhraseSnapshot[]
  readonly queueLength: number
  readonly nextPhraseId: string | null
  readonly nextPhraseName: string | null
  readonly lastPlayOutcome: PlayOutcome | null
  readonly settingsSaveState: SettingsSaveState
  readonly settingsLastSavedAtMs: number | null
  readonly categoryFilter: string
  readonly outputDevices: readonly AudioOutputDeviceSnapshot[]
  readonly selectedOutputDeviceId: string | null
  readonly playbackOutputDeviceId: string | null
  readonly playbackOutputDeviceName: string | null
  readonly outputDeviceWarning: string | null
  readonly hasVirtualOutputDevice: boolean
  readonly selectedIsVirtual: boolean
  readonly virtualRoutingStatus: VirtualRoutingStatus
  readonly inputDevices: readonly AudioInputDeviceSnapshot[]
  readonly selectedInputDeviceId: string | null
  readonly captureDeviceName: string | null
  readonly microphoneActive: boolean
  readonly microphoneError: string | null
  readonly mixerRunning: boolean
  readonly microphoneGain: number
  readonly playbackGain: number
  readonly masterGain: number
  readonly microphonePeak: number
  readonly microphoneRms: number
  readonly playbackPeak: number
  readonly playbackRms: number
  readonly outputPeak: number
  readonly outputRms: number
  readonly microphoneClipped: boolean
  readonly playbackClipped: boolean
  readonly outputClipped: boolean
  readonly calibrationShowRms: boolean
  readonly calibrationPeakHoldEnabled: boolean
  readonly calibrationHistoryEnabled: boolean
}

export const IPC_CHANNELS = Object.freeze({
  getStatus: 'sidecar:get-status',
  statusChanged: 'sidecar:status-changed',
  runProbes: 'sidecar:run-probes',
  selectWav: 'sidecar:select-wav',
  playAudio: 'sidecar:play-audio',
  stopPlayback: 'sidecar:stop-playback',
  getAudioOutputDevices: 'sidecar:get-audio-output-devices',
  setOutputDevice: 'sidecar:set-output-device',
  getAudioInputDevices: 'sidecar:get-audio-input-devices',
  setMicrophone: 'sidecar:set-microphone',
  startMicrophone: 'sidecar:start-microphone',
  stopMicrophone: 'sidecar:stop-microphone',
  setMixerGains: 'sidecar:set-mixer-gains',
  playTestTone: 'sidecar:play-test-tone'
} as const)

export function deriveVirtualRoutingFields(
  devices: readonly AudioOutputDeviceSnapshot[],
  selectedOutputDeviceId: string | null
): Pick<
  SidecarStatusSnapshot,
  'hasVirtualOutputDevice' | 'selectedIsVirtual' | 'virtualRoutingStatus'
> {
  const hasVirtualOutputDevice = devices.some(
    (device) => device.isVirtualDevice && device.supportsPlayback
  )
  const selected = selectedOutputDeviceId
    ? devices.find((device) => device.id === selectedOutputDeviceId)
    : undefined
  const selectedIsVirtual = selected?.isVirtualDevice === true

  let virtualRoutingStatus: VirtualRoutingStatus
  if (!hasVirtualOutputDevice) {
    virtualRoutingStatus = 'no_virtual_device'
  } else if (selectedIsVirtual) {
    virtualRoutingStatus = 'virtual_selected'
  } else if (selectedOutputDeviceId) {
    virtualRoutingStatus = 'physical_selected'
  } else {
    virtualRoutingStatus = 'virtual_available'
  }

  return { hasVirtualOutputDevice, selectedIsVirtual, virtualRoutingStatus }
}

export function createInitialSidecarStatus(): SidecarStatusSnapshot {
  return {
    connectionState: 'stopped',
    protocolVersion: null,
    sidecarVersion: null,
    healthLabel: null,
    lastResponse: null,
    lastLatencyMs: null,
    lastError: null,
    probes: [],
    restartCount: 0,
    selectedWavPath: null,
    playbackState: 'idle',
    playbackId: null,
    playbackDurationMs: null,
    lastPlaybackEvent: null,
    playbackError: null,
    playbackStartedAtMs: null,
    phrases: [],
    playingPhraseId: null,
    playingPhraseName: null,
    hotkeyBindings: [],
    playbackMode: 'interrupt',
    playbackQueue: [],
    queueLength: 0,
    nextPhraseId: null,
    nextPhraseName: null,
    lastPlayOutcome: null,
    settingsSaveState: 'idle',
    settingsLastSavedAtMs: null,
    categoryFilter: '',
    outputDevices: [],
    selectedOutputDeviceId: null,
    playbackOutputDeviceId: null,
    playbackOutputDeviceName: null,
    outputDeviceWarning: null,
    hasVirtualOutputDevice: false,
    selectedIsVirtual: false,
    virtualRoutingStatus: 'no_virtual_device',
    inputDevices: [],
    selectedInputDeviceId: null,
    captureDeviceName: null,
    microphoneActive: false,
    microphoneError: null,
    mixerRunning: false,
    microphoneGain: 1,
    playbackGain: 1,
    masterGain: 1,
    microphonePeak: 0,
    microphoneRms: 0,
    playbackPeak: 0,
    playbackRms: 0,
    outputPeak: 0,
    outputRms: 0,
    microphoneClipped: false,
    playbackClipped: false,
    outputClipped: false,
    calibrationShowRms: true,
    calibrationPeakHoldEnabled: true,
    calibrationHistoryEnabled: true
  }
}
