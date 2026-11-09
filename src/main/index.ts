import { app, BrowserWindow, net, protocol, shell } from 'electron'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import appIcon from '../../build/icon.png?asset'
import { registerFileIpc } from './ipc/files'
import { registerPluginIpc } from './ipc/plugins'
import { registerAppIpc } from './ipc/app'
import { buildMenu } from './menu'
import { setMainLanguage } from './i18n'
import { IPC } from '../shared/ipc'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'scriba-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  },
  {
    // Used only for relative Markdown links; it never serves content.
    scheme: 'scriba-open',
    privileges: { standard: true, secure: true }
  }
])

let mainWindow: BrowserWindow | null = null
const pendingPaths: string[] = []

const DOC_EXT = /\.(md|markdown|mdown|mkd|mdx|txt)$/i

function fileArgs(argv: string[]): string[] {
  const start = app.isPackaged ? 1 : 2
  return argv.slice(start).filter((arg) => !arg.startsWith('-'))
}

function openPaths(paths: string[]): void {
  if (!mainWindow) return
  for (const path of paths) {
    let isDirectory = false
    try {
      isDirectory = statSync(path).isDirectory()
    } catch {
      continue
    }
    if (isDirectory) {
      mainWindow.webContents.send(IPC.openFolderPath, path)
    } else if (DOC_EXT.test(path)) {
      mainWindow.webContents.send(IPC.openPath, path)
    }
  }
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * The renderer URL used in development, with `localhost` forced to IPv4.
 *
 * Vite binds to whatever `localhost` resolves to, which on Windows can be `::1`
 * only, while Chromium may try `127.0.0.1` first. When that happens the renderer
 * never loads, `ready-to-show` never fires, and the app hangs with no window.
 */
function devRendererUrl(): string | null {
  const url = process.env['ELECTRON_RENDERER_URL']
  return url ? url.replace('//localhost', '//127.0.0.1') : null
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 780,
    minHeight: 520,
    show: false,
    icon: appIcon,
    // Matches the default theme's --bg-sidebar so the first paint does not flash grey
    // before the renderer applies its stylesheet.
    backgroundColor: '#141020',
    autoHideMenuBar: process.platform !== 'darwin',
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 14 } }
      : process.platform === 'win32'
        ? {
            titleBarStyle: 'hidden' as const,
            titleBarOverlay: {
              color: '#141020',
              symbolColor: '#b6abcf',
              height: 40
            }
          }
        : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Spellcheck is off by default (most documents are Markdown, where red
      // squiggles are noise) but the preference must be able to turn it on, so this
      // starts enabled and the renderer applies the saved setting at startup.
      spellcheck: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // A renderer that never finishes loading (dev server unreachable, broken bundle,
  // stalled network) never emits `ready-to-show`, and the window would stay hidden
  // forever while the process keeps running. Show it anyway so the failure is at
  // least visible instead of looking like a frozen terminal.
  const revealTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      console.warn('[scriba] window was still not ready after 8s; showing it anyway')
      mainWindow.show()
    }
  }, 8000)
  mainWindow.once('closed', () => clearTimeout(revealTimer))

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
    }
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer] process gone', details)
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', false)
  })

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) {
        shell.openExternal(url)
        return { action: 'deny' }
      }
      // Relative Markdown links are rewritten to this scheme by the renderer so a
      // click can open the target document in the editor instead of a browser.
      if (url.startsWith('scriba-open:')) {
        try {
          const target = decodeURIComponent(new URL(url).searchParams.get('p') ?? '')
          if (target) openPaths([target])
        } catch {
          // Ignore malformed links.
        }
        return { action: 'deny' }
      }
      return { action: 'deny' }
    })

  mainWindow.webContents.once('did-finish-load', () => {
    openPaths([...pendingPaths.splice(0), ...fileArgs(process.argv)])
  })

  const rendererUrl = devRendererUrl()
  let loadRetries = 0

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 /* ERR_ABORTED */) return
      console.error(
        `[scriba] failed to load ${validatedURL}: ${errorDescription} (${errorCode})`
      )
      // The dev server may still be starting up (or a previous one shutting down).
      if (rendererUrl && loadRetries < 3) {
        loadRetries += 1
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(rendererUrl)
        }, 1000)
      }
    }
  )

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (mainWindow && !mainWindow.isDestroyed()) openPaths([path])
  else pendingPaths.push(path)
})

if (process.platform === 'win32') app.setAppUserModelId('io.github.scriba')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  // Without this line a second launch just disappears, which looks like a hang.
  console.error('[scriba] another Scriba instance is already running; exiting this one')
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      openPaths(fileArgs(argv))
    }
  })

  app.whenReady().then(() => {
    protocol.handle('scriba-media', async (request) => {
      let filePath: string | null = null
      try {
        const url = new URL(request.url)
        filePath = url.searchParams.get('p')
        if (!filePath) return new Response('Missing path', { status: 400 })

        // `net.fetch` rejects with ERR_FILE_NOT_FOUND for missing files, which
        // surfaced as an unhandled "Error: net::ERR_FILE_NOT_FOUND" stack trace at
        // startup (once per broken image). Check first and answer with a plain 404
        // instead; the renderer already shows a fallback for failed images.
        if (!statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
          console.warn(`[scriba] media file not found: ${filePath}`)
          return new Response('Not found', { status: 404 })
        }

        return await net.fetch(pathToFileURL(filePath).toString())
      } catch (error) {
        if (filePath) console.warn(`[scriba] could not load media file: ${filePath}`, error)
        return new Response('Not found', { status: 404 })
      }
    })

    setMainLanguage(app.getLocale())
    registerFileIpc()
    registerPluginIpc()
    registerAppIpc()
    void buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
