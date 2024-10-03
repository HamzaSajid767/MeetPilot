import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { Phrase } from '../shared/phrase'
import {
  RECORDING_IPC_CHANNELS,
  type PendingRecording,
  type SaveRecordedPhraseRequest
} from '../shared/recording'
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

export function registerRecordingIpc(manager: SidecarManager, logger: Logger): () => void {
  const startHandler = async (
    event: IpcMainInvokeEvent
  ): Promise<{ readonly id: string; readonly startedAtMs: number }> => {
    assertTrusted(event, logger, RECORDING_IPC_CHANNELS.start)
    return manager.startPhraseRecording()
  }

  const stopHandler = async (event: IpcMainInvokeEvent): Promise<PendingRecording> => {
    assertTrusted(event, logger, RECORDING_IPC_CHANNELS.stop)
    return manager.stopPhraseRecording()
  }

  const cancelHandler = async (event: IpcMainInvokeEvent): Promise<void> => {
    assertTrusted(event, logger, RECORDING_IPC_CHANNELS.cancel)
    await manager.cancelPhraseRecording()
  }

  const saveHandler = async (
    event: IpcMainInvokeEvent,
    request: SaveRecordedPhraseRequest
  ): Promise<Phrase> => {
    assertTrusted(event, logger, RECORDING_IPC_CHANNELS.save)
    if (request == null || typeof request !== 'object') {
      throw new Error('Save request is required')
    }
    return manager.saveRecordedPhrase(request)
  }

  const discardHandler = async (event: IpcMainInvokeEvent): Promise<void> => {
    assertTrusted(event, logger, RECORDING_IPC_CHANNELS.discard)
    await manager.discardRecordedPhrase()
  }

  ipcMain.handle(RECORDING_IPC_CHANNELS.start, startHandler)
  ipcMain.handle(RECORDING_IPC_CHANNELS.stop, stopHandler)
  ipcMain.handle(RECORDING_IPC_CHANNELS.cancel, cancelHandler)
  ipcMain.handle(RECORDING_IPC_CHANNELS.save, saveHandler)
  ipcMain.handle(RECORDING_IPC_CHANNELS.discard, discardHandler)

  return () => {
    ipcMain.removeHandler(RECORDING_IPC_CHANNELS.start)
    ipcMain.removeHandler(RECORDING_IPC_CHANNELS.stop)
    ipcMain.removeHandler(RECORDING_IPC_CHANNELS.cancel)
    ipcMain.removeHandler(RECORDING_IPC_CHANNELS.save)
    ipcMain.removeHandler(RECORDING_IPC_CHANNELS.discard)
  }
}
