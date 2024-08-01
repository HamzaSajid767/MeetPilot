import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS, type SidecarStatusSnapshot } from '../shared/sidecar-status'
import type { SidecarManager } from './sidecar-manager'
import type { Logger } from './logger'

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  if (url.startsWith('file://')) {
    return true
  }

  if (process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL)) {
    return true
  }

  return url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')
}

function assertTrusted(event: IpcMainInvokeEvent, logger: Logger, channel: string): void {
  if (!isTrustedSender(event)) {
    logger.warn(`Rejected ${channel} from untrusted sender`, {}, 'ipc.untrusted_sender')
    throw new Error('Untrusted IPC sender')
  }
}

export function registerSidecarIpc(manager: SidecarManager, logger: Logger): () => void {
  const getStatusHandler = (event: IpcMainInvokeEvent): SidecarStatusSnapshot => {
    assertTrusted(event, logger, IPC_CHANNELS.getStatus)
    return manager.getStatus()
  }

  const runProbesHandler = async (event: IpcMainInvokeEvent): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.runProbes)
    await manager.runProbes()
    return manager.getStatus()
  }

  const selectWavHandler = async (event: IpcMainInvokeEvent): Promise<string | null> => {
    assertTrusted(event, logger, IPC_CHANNELS.selectWav)
    const window = BrowserWindow.fromWebContents(event.sender)
    const dialogOptions = {
      title: 'Select WAV file',
      properties: ['openFile'] as Array<'openFile'>,
      filters: [{ name: 'WAV audio', extensions: ['wav'] }]
    }
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]!
    manager.setSelectedWavPath(filePath)
    return filePath
  }

  const playAudioHandler = async (
    event: IpcMainInvokeEvent,
    volume?: number
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.playAudio)
    const status = manager.getStatus()
    if (!status.selectedWavPath) {
      throw new Error('Select a WAV file before playing')
    }

    return manager.playAudio(status.selectedWavPath, typeof volume === 'number' ? volume : 1)
  }

  const stopPlaybackHandler = async (event: IpcMainInvokeEvent): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.stopPlayback)
    return manager.stopPlayback()
  }

  const getAudioOutputDevicesHandler = async (
    event: IpcMainInvokeEvent
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.getAudioOutputDevices)
    return manager.getAudioOutputDevices()
  }

  const setOutputDeviceHandler = async (
    event: IpcMainInvokeEvent,
    deviceId: string
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.setOutputDevice)
    if (typeof deviceId !== 'string') {
      throw new Error('deviceId must be a string')
    }
    return manager.setOutputDevice(deviceId)
  }

  const getAudioInputDevicesHandler = async (
    event: IpcMainInvokeEvent
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.getAudioInputDevices)
    return manager.getAudioInputDevices()
  }

  const setMicrophoneHandler = async (
    event: IpcMainInvokeEvent,
    deviceId: string
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.setMicrophone)
    if (typeof deviceId !== 'string') {
      throw new Error('deviceId must be a string')
    }
    return manager.setMicrophone(deviceId)
  }

  const startMicrophoneHandler = async (
    event: IpcMainInvokeEvent
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.startMicrophone)
    return manager.startMicrophone()
  }

  const stopMicrophoneHandler = async (
    event: IpcMainInvokeEvent
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.stopMicrophone)
    return manager.stopMicrophone()
  }

  const setMixerGainsHandler = async (
    event: IpcMainInvokeEvent,
    microphoneGain: number,
    playbackGain: number,
    masterGain?: number
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.setMixerGains)
    if (typeof microphoneGain !== 'number' || typeof playbackGain !== 'number') {
      throw new Error('microphoneGain and playbackGain must be numbers')
    }
    if (masterGain !== undefined && typeof masterGain !== 'number') {
      throw new Error('masterGain must be a number when provided')
    }
    return manager.setMixerGains(microphoneGain, playbackGain, masterGain)
  }

  const playTestToneHandler = async (
    event: IpcMainInvokeEvent,
    options: {
      kind?: string
      frequencyHz?: number
      volume?: number
      durationMs?: number
    }
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, IPC_CHANNELS.playTestTone)
    if (
      options == null ||
      typeof options !== 'object' ||
      (options.kind !== 'sine' && options.kind !== 'pink' && options.kind !== 'white') ||
      typeof options.volume !== 'number'
    ) {
      throw new Error('PlayTestTone requires kind (sine|pink|white) and volume')
    }
    return manager.playTestTone({
      kind: options.kind,
      volume: options.volume,
      ...(typeof options.frequencyHz === 'number' ? { frequencyHz: options.frequencyHz } : {}),
      ...(typeof options.durationMs === 'number' ? { durationMs: options.durationMs } : {})
    })
  }

  ipcMain.handle(IPC_CHANNELS.getStatus, getStatusHandler)
  ipcMain.handle(IPC_CHANNELS.runProbes, runProbesHandler)
  ipcMain.handle(IPC_CHANNELS.selectWav, selectWavHandler)
  ipcMain.handle(IPC_CHANNELS.playAudio, playAudioHandler)
  ipcMain.handle(IPC_CHANNELS.stopPlayback, stopPlaybackHandler)
  ipcMain.handle(IPC_CHANNELS.getAudioOutputDevices, getAudioOutputDevicesHandler)
  ipcMain.handle(IPC_CHANNELS.setOutputDevice, setOutputDeviceHandler)
  ipcMain.handle(IPC_CHANNELS.getAudioInputDevices, getAudioInputDevicesHandler)
  ipcMain.handle(IPC_CHANNELS.setMicrophone, setMicrophoneHandler)
  ipcMain.handle(IPC_CHANNELS.startMicrophone, startMicrophoneHandler)
  ipcMain.handle(IPC_CHANNELS.stopMicrophone, stopMicrophoneHandler)
  ipcMain.handle(IPC_CHANNELS.setMixerGains, setMixerGainsHandler)
  ipcMain.handle(IPC_CHANNELS.playTestTone, playTestToneHandler)

  const onStatus = (status: SidecarStatusSnapshot): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.statusChanged, status)
      }
    }
  }

  manager.on('status', onStatus)

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.getStatus)
    ipcMain.removeHandler(IPC_CHANNELS.runProbes)
    ipcMain.removeHandler(IPC_CHANNELS.selectWav)
    ipcMain.removeHandler(IPC_CHANNELS.playAudio)
    ipcMain.removeHandler(IPC_CHANNELS.stopPlayback)
    ipcMain.removeHandler(IPC_CHANNELS.getAudioOutputDevices)
    ipcMain.removeHandler(IPC_CHANNELS.setOutputDevice)
    ipcMain.removeHandler(IPC_CHANNELS.getAudioInputDevices)
    ipcMain.removeHandler(IPC_CHANNELS.setMicrophone)
    ipcMain.removeHandler(IPC_CHANNELS.startMicrophone)
    ipcMain.removeHandler(IPC_CHANNELS.stopMicrophone)
    ipcMain.removeHandler(IPC_CHANNELS.setMixerGains)
    ipcMain.removeHandler(IPC_CHANNELS.playTestTone)
    manager.off('status', onStatus)
  }
}
