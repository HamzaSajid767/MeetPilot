import { app, BrowserWindow, globalShortcut } from 'electron'
import path from 'node:path'
import { PROTOCOL_VERSION } from '../shared/protocol'
import {
  SETTINGS_SCHEMA_VERSION,
  type AppSettingsDocument
} from '../shared/settings'
import { createAppPathsService } from './app-paths'
import {
  LOG_CATEGORIES,
  LOG_EVENT_IDS,
  createConsoleJsonSink,
  createJsonFileSink,
  createLoggerFactory,
  resolveMinimumLogLevel,
  type Logger
} from './logger'
import { registerSidecarIpc } from './sidecar-ipc'
import { SidecarManager } from './sidecar-manager'
import { PhraseLibrary } from './phrase-library'
import { registerPhraseIpc } from './phrase-ipc'
import { registerPlaybackIpc } from './playback-ipc'
import { registerSettingsIpc } from './settings-ipc'
import { registerTtsIpc } from './tts-ipc'
import { registerRecordingIpc } from './recording-ipc'
import { SettingsStore } from './settings-store'
import { HotkeyService } from './hotkey-service'
import { createMainWindow } from './window'

const startedAt = Date.now()
const isDevelopment = !app.isPackaged || process.env.NODE_ENV === 'development'

const loggerFactory = createLoggerFactory({
  minimumLevel: resolveMinimumLogLevel(isDevelopment, process.env.ZOOM_DIALER_LOG_LEVEL),
  sinks: [createConsoleJsonSink()],
  baseContext: {
    process: 'desktop-main'
  }
})

const log = loggerFactory.createLogger(LOG_CATEGORIES.main)
let sidecarManager: SidecarManager | null = null
let phraseLibrary: PhraseLibrary | null = null
let hotkeyService: HotkeyService | null = null
let settingsStore: SettingsStore | null = null
let unregisterSidecarIpc: (() => void) | null = null
let unregisterPhraseIpc: (() => void) | null = null
let unregisterPlaybackIpc: (() => void) | null = null
let unregisterSettingsIpc: (() => void) | null = null
let unregisterTtsIpc: (() => void) | null = null
let unregisterRecordingIpc: (() => void) | null = null
let unsubscribeSettingsStatus: (() => void) | null = null
let isQuitting = false
let suppressPersist = false

function registerProcessHandlers(logger: Logger): void {
  process.on('uncaughtException', (error) => {
    logger.critical(
      'Uncaught exception',
      {
        error
      },
      LOG_EVENT_IDS.uncaughtException
    )
  })

  process.on('unhandledRejection', (reason) => {
    logger.error(
      'Unhandled rejection',
      {
        reason: reason instanceof Error ? reason : { value: String(reason) }
      },
      LOG_EVENT_IDS.unhandledRejection
    )
  })
}

function syncSettingsStatusToSidecar(): void {
  if (!sidecarManager || !settingsStore) {
    return
  }
  const status = settingsStore.getStatus()
  sidecarManager.setSettingsUiFields({
    settingsSaveState: status.saveState,
    settingsLastSavedAtMs: status.lastSavedAtMs,
    categoryFilter: status.categoryFilter
  })
}

function persistFromLiveState(): void {
  if (suppressPersist || !settingsStore || !phraseLibrary || !sidecarManager) {
    return
  }

  const status = sidecarManager.getStatus()
  const document: AppSettingsDocument = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    phrases: phraseLibrary.list(),
    audio: {
      selectedOutputDeviceId: status.selectedOutputDeviceId,
      selectedInputDeviceId: status.selectedInputDeviceId,
      microphoneGain: status.microphoneGain,
      playbackGain: status.playbackGain,
      masterGain: status.masterGain
    },
    calibration: {
      showRms: status.calibrationShowRms,
      peakHoldEnabled: status.calibrationPeakHoldEnabled,
      historyEnabled: status.calibrationHistoryEnabled
    },
    playbackMode: status.playbackMode,
    ui: {
      categoryFilter: settingsStore.get().ui.categoryFilter
    }
  }
  settingsStore.replace(document)
}

async function applySettingsDocument(document: AppSettingsDocument): Promise<void> {
  if (!phraseLibrary || !sidecarManager || !hotkeyService || !settingsStore) {
    return
  }

  suppressPersist = true
  try {
    phraseLibrary.replaceAll(document.phrases)
    sidecarManager.applyPersistedAudioPrefs(document.audio)
    sidecarManager.applyPersistedCalibrationPrefs(document.calibration)
    sidecarManager.setPlaybackMode(document.playbackMode)
    // document already in store from import/reset
    hotkeyService.sync()
    syncSettingsStatusToSidecar()
  } finally {
    suppressPersist = false
  }
}

async function bootstrap(): Promise<void> {
  registerProcessHandlers(log)

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.septsol.zoomdialercompanion')
  }

  await app.whenReady()
  log.info(
    'Application ready',
    {
      version: app.getVersion(),
      protocolVersion: PROTOCOL_VERSION,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      packaged: app.isPackaged,
      sessionId: loggerFactory.getSessionId()
    },
    LOG_EVENT_IDS.appReady
  )

  const appPaths = createAppPathsService(app.getPath('appData'))
  await appPaths.ensureCreated()
  loggerFactory.addSink(createJsonFileSink(appPaths.logs))
  log.info(
    'Application data directories ready',
    {
      logsDirectoryName: 'logs',
      hasFileSink: true
    },
    LOG_EVENT_IDS.appDataReady
  )

  settingsStore = new SettingsStore(path.join(appPaths.config, 'settings.json'))
  const loaded = await settingsStore.load()
  log.info(
    'Settings loaded',
    {
      phraseCount: loaded.phrases.length,
      playbackMode: loaded.playbackMode
    },
    'settings.loaded'
  )

  const sidecarLog = loggerFactory.createLogger('sidecar')
  phraseLibrary = new PhraseLibrary()
  suppressPersist = true
  phraseLibrary.replaceAll(loaded.phrases)
  sidecarManager = new SidecarManager(sidecarLog, phraseLibrary, {
    assetsDirectory: appPaths.assets,
    tempDirectory: appPaths.temp
  })
  sidecarManager.applyPersistedAudioPrefs(loaded.audio)
  sidecarManager.applyPersistedCalibrationPrefs(loaded.calibration)
  sidecarManager.setPlaybackMode(loaded.playbackMode)
  syncSettingsStatusToSidecar()
  suppressPersist = false

  sidecarManager.setConfigChangedHandler(() => {
    persistFromLiveState()
  })

  unsubscribeSettingsStatus = settingsStore.onStatusChanged(() => {
    syncSettingsStatusToSidecar()
  })

  unregisterSidecarIpc = registerSidecarIpc(sidecarManager, log)

  const hotkeyLog = loggerFactory.createLogger('hotkeys')
  hotkeyService = new HotkeyService(
    phraseLibrary,
    (phraseId) => sidecarManager!.playPhrase(phraseId, 1),
    hotkeyLog,
    globalShortcut
  )
  hotkeyService.on('status', (bindings) => {
    sidecarManager?.setHotkeyBindings(bindings)
  })

  unregisterPhraseIpc = registerPhraseIpc(phraseLibrary, sidecarManager, hotkeyService, log)
  unregisterPlaybackIpc = registerPlaybackIpc(sidecarManager, log)
  unregisterTtsIpc = registerTtsIpc(sidecarManager, log)
  unregisterRecordingIpc = registerRecordingIpc(sidecarManager, log)
  unregisterSettingsIpc = registerSettingsIpc({
    store: settingsStore,
    logger: log,
    exportsDirectory: appPaths.exports,
    importsDirectory: appPaths.imports,
    applyDocument: applySettingsDocument,
    persistFromLiveState,
    onCalibrationChanged: (calibration) => {
      sidecarManager?.applyPersistedCalibrationPrefs(calibration)
    }
  })

  hotkeyService.sync()

  const windowLog = loggerFactory.createLogger(LOG_CATEGORIES.window)
  createMainWindow(windowLog)

  void sidecarManager.start().catch((error: unknown) => {
    log.error(
      'Sidecar manager failed to start',
      {
        error: error instanceof Error ? error : { message: String(error) }
      },
      'sidecar.start_failed'
    )
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(windowLog)
    }
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (isQuitting) {
    return
  }

  event.preventDefault()
  isQuitting = true
  log.info(
    'Application quitting',
    {
      uptimeMs: Date.now() - startedAt
    },
    LOG_EVENT_IDS.appQuitting
  )

  void (async () => {
    try {
      persistFromLiveState()
      await settingsStore?.saveNow()
      hotkeyService?.dispose()
      hotkeyService = null
      unregisterSidecarIpc?.()
      unregisterSidecarIpc = null
      unregisterPhraseIpc?.()
      unregisterPhraseIpc = null
      unregisterPlaybackIpc?.()
      unregisterPlaybackIpc = null
      unregisterTtsIpc?.()
      unregisterTtsIpc = null
      unregisterRecordingIpc?.()
      unregisterRecordingIpc = null
      unregisterSettingsIpc?.()
      unregisterSettingsIpc = null
      unsubscribeSettingsStatus?.()
      unsubscribeSettingsStatus = null
      await sidecarManager?.stop()
      sidecarManager = null
      phraseLibrary = null
      settingsStore = null
    } finally {
      app.exit(0)
    }
  })()
})

void bootstrap().catch((error: unknown) => {
  log.critical(
    'Bootstrap failed',
    {
      error: error instanceof Error ? error : { message: String(error) }
    },
    LOG_EVENT_IDS.bootstrapFailed
  )
  app.exit(1)
})
