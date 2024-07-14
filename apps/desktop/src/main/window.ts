import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { LOG_EVENT_IDS, type Logger } from './logger'

const MIN_WIDTH = 960
const MIN_HEIGHT = 640
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 800

export function createMainWindow(log: Logger): BrowserWindow {
  const window = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'Zoom Dialer Companion',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  window.on('ready-to-show', () => {
    window.show()
    log.info('Main window ready', undefined, LOG_EVENT_IDS.windowReady)
  })

  window.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
    log.info(
      'Loading renderer from Vite dev server',
      {
        hasDevServerUrl: true
      },
      LOG_EVENT_IDS.windowLoadDev
    )
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
    log.info('Loading packaged renderer', undefined, LOG_EVENT_IDS.windowLoadPackaged)
  }

  return window
}
