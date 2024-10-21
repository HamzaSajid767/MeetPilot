import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  isPlaybackMode,
  PLAYBACK_IPC_CHANNELS,
  type PlaybackMode
} from '../shared/playback'
import type { SidecarStatusSnapshot } from '../shared/sidecar-status'
import type { Logger } from './logger'
import type { SidecarManager } from './sidecar-manager'

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

export function registerPlaybackIpc(manager: SidecarManager, logger: Logger): () => void {
  const setModeHandler = (
    event: IpcMainInvokeEvent,
    mode: PlaybackMode
  ): SidecarStatusSnapshot => {
    assertTrusted(event, logger, PLAYBACK_IPC_CHANNELS.setMode)
    if (!isPlaybackMode(mode)) {
      throw new Error('mode must be interrupt, queue, or ignore')
    }
    return manager.setPlaybackMode(mode)
  }

  const clearQueueHandler = (event: IpcMainInvokeEvent): SidecarStatusSnapshot => {
    assertTrusted(event, logger, PLAYBACK_IPC_CHANNELS.clearQueue)
    return manager.clearPlaybackQueue()
  }

  const removeQueuedHandler = (
    event: IpcMainInvokeEvent,
    phraseId: string
  ): SidecarStatusSnapshot => {
    assertTrusted(event, logger, PLAYBACK_IPC_CHANNELS.removeQueued)
    if (typeof phraseId !== 'string') {
      throw new Error('phraseId must be a string')
    }
    return manager.removeQueuedPhrase(phraseId)
  }

  const skipHandler = async (event: IpcMainInvokeEvent): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, PLAYBACK_IPC_CHANNELS.skip)
    return manager.skipCurrentPhrase()
  }

  ipcMain.handle(PLAYBACK_IPC_CHANNELS.setMode, setModeHandler)
  ipcMain.handle(PLAYBACK_IPC_CHANNELS.clearQueue, clearQueueHandler)
  ipcMain.handle(PLAYBACK_IPC_CHANNELS.removeQueued, removeQueuedHandler)
  ipcMain.handle(PLAYBACK_IPC_CHANNELS.skip, skipHandler)

  return () => {
    ipcMain.removeHandler(PLAYBACK_IPC_CHANNELS.setMode)
    ipcMain.removeHandler(PLAYBACK_IPC_CHANNELS.clearQueue)
    ipcMain.removeHandler(PLAYBACK_IPC_CHANNELS.removeQueued)
    ipcMain.removeHandler(PLAYBACK_IPC_CHANNELS.skip)
  }
}
