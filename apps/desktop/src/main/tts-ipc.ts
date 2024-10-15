import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { Phrase } from '../shared/phrase'
import type { SidecarStatusSnapshot } from '../shared/sidecar-status'
import {
  TTS_IPC_CHANNELS,
  type CreateTtsPhraseRequest,
  type PreviewTtsRequest,
  type TtsVoice
} from '../shared/tts'
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

export function registerTtsIpc(manager: SidecarManager, logger: Logger): () => void {
  const listVoicesHandler = async (event: IpcMainInvokeEvent): Promise<readonly TtsVoice[]> => {
    assertTrusted(event, logger, TTS_IPC_CHANNELS.listVoices)
    return manager.getAvailableVoices()
  }

  const previewHandler = async (
    event: IpcMainInvokeEvent,
    request: PreviewTtsRequest
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, TTS_IPC_CHANNELS.preview)
    if (request == null || typeof request !== 'object') {
      throw new Error('Preview request is required')
    }
    return manager.previewTts(request)
  }

  const createHandler = async (
    event: IpcMainInvokeEvent,
    request: CreateTtsPhraseRequest
  ): Promise<Phrase> => {
    assertTrusted(event, logger, TTS_IPC_CHANNELS.create)
    if (request == null || typeof request !== 'object') {
      throw new Error('Create request is required')
    }
    return manager.createTtsPhrase(request)
  }

  ipcMain.handle(TTS_IPC_CHANNELS.listVoices, listVoicesHandler)
  ipcMain.handle(TTS_IPC_CHANNELS.preview, previewHandler)
  ipcMain.handle(TTS_IPC_CHANNELS.create, createHandler)

  return () => {
    ipcMain.removeHandler(TTS_IPC_CHANNELS.listVoices)
    ipcMain.removeHandler(TTS_IPC_CHANNELS.preview)
    ipcMain.removeHandler(TTS_IPC_CHANNELS.create)
  }
}
