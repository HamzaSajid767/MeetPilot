import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  PHRASE_IPC_CHANNELS,
  type Phrase,
  type PhraseImportResult,
  type PhraseReorderDirection
} from '../shared/phrase'
import type { SidecarStatusSnapshot } from '../shared/sidecar-status'
import type { Logger } from './logger'
import type { HotkeyService } from './hotkey-service'
import type { PhraseLibrary } from './phrase-library'
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

export function registerPhraseIpc(
  library: PhraseLibrary,
  manager: SidecarManager,
  hotkeys: HotkeyService,
  logger: Logger
): () => void {
  const listHandler = (event: IpcMainInvokeEvent): Phrase[] => {
    assertTrusted(event, logger, PHRASE_IPC_CHANNELS.list)
    return library.list()
  }

  const importHandler = async (event: IpcMainInvokeEvent): Promise<PhraseImportResult> => {
    assertTrusted(event, logger, PHRASE_IPC_CHANNELS.import)
    const window = BrowserWindow.fromWebContents(event.sender)
    const dialogOptions = {
      title: 'Import WAV phrases',
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      filters: [{ name: 'WAV audio', extensions: ['wav'] }]
    }
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || result.filePaths.length === 0) {
      return { imported: [], errors: [] }
    }

    return library.importPaths(result.filePaths)
  }

  const removeHandler = (event: IpcMainInvokeEvent, phraseId: string): Phrase[] => {
    assertTrusted(event, logger, PHRASE_IPC_CHANNELS.remove)
    if (typeof phraseId !== 'string') {
      throw new Error('phraseId must be a string')
    }
    library.remove(phraseId)
    return library.list()
  }

  const renameHandler = (
    event: IpcMainInvokeEvent,
    phraseId: string,
    name: string
  ): Phrase => {
    assertTrusted(event, logger, PHRASE_IPC_CHANNELS.rename)
    if (typeof phraseId !== 'string' || typeof name !== 'string') {
      throw new Error('phraseId and name must be strings')
    }
    return library.rename(phraseId, name)
  }

  const setEnabledHandler = (
    event: IpcMainInvokeEvent,
    phraseId: string,
    enabled: boolean
  ): Phrase => {
    assertTrusted(event, logger, PHRASE_IPC_CHANNELS.setEnabled)
    if (typeof phraseId !== 'string' || typeof enabled !== 'boolean') {
      throw new Error('phraseId must be a string and enabled must be a boolean')
    }
    return library.setEnabled(phraseId, enabled)
  }

  const setCategoryHandler = (
    event: IpcMainInvokeEvent,
    phraseId: string,
    category: string | null
  ): Phrase => {
    assertTrusted(event, logger, PHRASE_IPC_CHANNELS.setCategory)
    if (typeof phraseId !== 'string') {
      throw new Error('phraseId must be a string')
    }
    if (category !== null && typeof category !== 'string') {
      throw new Error('category must be a string or null')
    }
    return library.setCategory(phraseId, category)
  }

  const reorderHandler = (
    event: IpcMainInvokeEvent,
    phraseId: string,
    direction: PhraseReorderDirection
  ): Phrase[] => {
    assertTrusted(event, logger, PHRASE_IPC_CHANNELS.reorder)
    if (typeof phraseId !== 'string' || (direction !== 'up' && direction !== 'down')) {
      throw new Error('phraseId and direction (up|down) are required')
    }
    library.reorder(phraseId, direction)
    return library.list()
  }

  const playHandler = async (
    event: IpcMainInvokeEvent,
    phraseId: string,
    volume?: number
  ): Promise<SidecarStatusSnapshot> => {
    assertTrusted(event, logger, PHRASE_IPC_CHANNELS.play)
    if (typeof phraseId !== 'string') {
      throw new Error('phraseId must be a string')
    }
    return manager.playPhrase(phraseId, typeof volume === 'number' ? volume : 1)
  }

  const setShortcutHandler = (
    event: IpcMainInvokeEvent,
    phraseId: string,
    shortcut: string | null
  ): Phrase => {
    assertTrusted(event, logger, PHRASE_IPC_CHANNELS.setShortcut)
    if (typeof phraseId !== 'string') {
      throw new Error('phraseId must be a string')
    }
    if (shortcut !== null && typeof shortcut !== 'string') {
      throw new Error('shortcut must be a string or null')
    }
    return hotkeys.assignShortcut(phraseId, shortcut)
  }

  ipcMain.handle(PHRASE_IPC_CHANNELS.list, listHandler)
  ipcMain.handle(PHRASE_IPC_CHANNELS.import, importHandler)
  ipcMain.handle(PHRASE_IPC_CHANNELS.remove, removeHandler)
  ipcMain.handle(PHRASE_IPC_CHANNELS.rename, renameHandler)
  ipcMain.handle(PHRASE_IPC_CHANNELS.setEnabled, setEnabledHandler)
  ipcMain.handle(PHRASE_IPC_CHANNELS.setCategory, setCategoryHandler)
  ipcMain.handle(PHRASE_IPC_CHANNELS.reorder, reorderHandler)
  ipcMain.handle(PHRASE_IPC_CHANNELS.play, playHandler)
  ipcMain.handle(PHRASE_IPC_CHANNELS.setShortcut, setShortcutHandler)

  return () => {
    ipcMain.removeHandler(PHRASE_IPC_CHANNELS.list)
    ipcMain.removeHandler(PHRASE_IPC_CHANNELS.import)
    ipcMain.removeHandler(PHRASE_IPC_CHANNELS.remove)
    ipcMain.removeHandler(PHRASE_IPC_CHANNELS.rename)
    ipcMain.removeHandler(PHRASE_IPC_CHANNELS.setEnabled)
    ipcMain.removeHandler(PHRASE_IPC_CHANNELS.setCategory)
    ipcMain.removeHandler(PHRASE_IPC_CHANNELS.reorder)
    ipcMain.removeHandler(PHRASE_IPC_CHANNELS.play)
    ipcMain.removeHandler(PHRASE_IPC_CHANNELS.setShortcut)
  }
}
