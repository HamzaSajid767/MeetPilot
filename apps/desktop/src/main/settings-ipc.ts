import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import {
  SETTINGS_IPC_CHANNELS,
  type AppSettingsDocument,
  type PersistedCalibrationSettings,
  type SettingsStatusSnapshot
} from '../shared/settings'
import type { Logger } from './logger'
import type { SettingsStore } from './settings-store'

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

export interface SettingsIpcDeps {
  readonly store: SettingsStore
  readonly logger: Logger
  readonly exportsDirectory: string
  readonly importsDirectory: string
  readonly applyDocument: (document: AppSettingsDocument) => Promise<void> | void
  readonly persistFromLiveState: () => void
  readonly onCalibrationChanged?: (calibration: PersistedCalibrationSettings) => void
}

export function registerSettingsIpc(deps: SettingsIpcDeps): () => void {
  const { store, logger, exportsDirectory, importsDirectory, applyDocument, persistFromLiveState, onCalibrationChanged } =
    deps

  const getStatusHandler = (event: IpcMainInvokeEvent): SettingsStatusSnapshot => {
    assertTrusted(event, logger, SETTINGS_IPC_CHANNELS.getStatus)
    return store.getStatus()
  }

  const exportHandler = async (event: IpcMainInvokeEvent): Promise<string | null> => {
    assertTrusted(event, logger, SETTINGS_IPC_CHANNELS.exportFile)
    persistFromLiveState()
    await store.saveNow()

    const result = await dialog.showSaveDialog({
      title: 'Export settings',
      defaultPath: path.join(exportsDirectory, 'settings-export.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    await store.exportTo(result.filePath)
    return result.filePath
  }

  const importHandler = async (event: IpcMainInvokeEvent): Promise<SettingsStatusSnapshot> => {
    assertTrusted(event, logger, SETTINGS_IPC_CHANNELS.importFile)

    const result = await dialog.showOpenDialog({
      title: 'Import settings',
      defaultPath: importsDirectory,
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return store.getStatus()
    }

    const document = await store.importFrom(result.filePaths[0]!)
    await applyDocument(document)
    return store.getStatus()
  }

  const resetHandler = async (event: IpcMainInvokeEvent): Promise<SettingsStatusSnapshot> => {
    assertTrusted(event, logger, SETTINGS_IPC_CHANNELS.reset)
    const document = await store.resetToDefaults()
    await applyDocument(document)
    return store.getStatus()
  }

  const setCategoryHandler = (
    event: IpcMainInvokeEvent,
    categoryFilter: string
  ): SettingsStatusSnapshot => {
    assertTrusted(event, logger, SETTINGS_IPC_CHANNELS.setCategoryFilter)
    if (typeof categoryFilter !== 'string') {
      throw new Error('categoryFilter must be a string')
    }
    return store.setCategoryFilter(categoryFilter)
  }

  const setCalibrationHandler = (
    event: IpcMainInvokeEvent,
    prefs: PersistedCalibrationSettings
  ): SettingsStatusSnapshot => {
    assertTrusted(event, logger, SETTINGS_IPC_CHANNELS.setCalibration)
    if (
      prefs == null ||
      typeof prefs !== 'object' ||
      typeof prefs.showRms !== 'boolean' ||
      typeof prefs.peakHoldEnabled !== 'boolean' ||
      typeof prefs.historyEnabled !== 'boolean'
    ) {
      throw new Error('calibration prefs must include showRms, peakHoldEnabled, historyEnabled booleans')
    }
    const status = store.setCalibration(prefs)
    onCalibrationChanged?.(prefs)
    return status
  }

  ipcMain.handle(SETTINGS_IPC_CHANNELS.getStatus, getStatusHandler)
  ipcMain.handle(SETTINGS_IPC_CHANNELS.exportFile, exportHandler)
  ipcMain.handle(SETTINGS_IPC_CHANNELS.importFile, importHandler)
  ipcMain.handle(SETTINGS_IPC_CHANNELS.reset, resetHandler)
  ipcMain.handle(SETTINGS_IPC_CHANNELS.setCategoryFilter, setCategoryHandler)
  ipcMain.handle(SETTINGS_IPC_CHANNELS.setCalibration, setCalibrationHandler)

  return () => {
    ipcMain.removeHandler(SETTINGS_IPC_CHANNELS.getStatus)
    ipcMain.removeHandler(SETTINGS_IPC_CHANNELS.exportFile)
    ipcMain.removeHandler(SETTINGS_IPC_CHANNELS.importFile)
    ipcMain.removeHandler(SETTINGS_IPC_CHANNELS.reset)
    ipcMain.removeHandler(SETTINGS_IPC_CHANNELS.setCategoryFilter)
    ipcMain.removeHandler(SETTINGS_IPC_CHANNELS.setCalibration)
  }
}
