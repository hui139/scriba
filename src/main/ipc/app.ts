import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { IPC } from '../../shared/ipc'
import type { AppInfo } from '../../shared/types'
import { buildMenu } from '../menu'
import { getMainLanguage, normalizeMainLanguage, setMainLanguage } from '../i18n'
import { writeEpub } from '../export/epub'
import { exportFolder, suggestedExportName } from '../export/folder'

const MAX_RECENT = 10

function recentFilePath(): string {
  return join(app.getPath('userData'), 'recent-files.json')
}

async function readRecent(): Promise<string[]> {
  try {
    const raw = await fs.readFile(recentFilePath(), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

async function writeRecent(list: string[]): Promise<void> {
  try {
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(recentFilePath(), JSON.stringify(list, null, 2), 'utf8')
  } catch {
    // Recent files are a convenience; failing to persist them must not break the app.
  }
}

export function registerAppIpc(): void {
  ipcMain.handle(IPC.appInfo, async (): Promise<AppInfo> => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      userDataDir: app.getPath('userData'),
      pluginsDir: join(app.getPath('userData'), 'plugins'),
      themesDir: join(app.getPath('userData'), 'themes')
    }
  })

  ipcMain.handle(IPC.appSetLanguage, async (_e, language: string) => {
    if (normalizeMainLanguage(language) !== getMainLanguage()) {
      setMainLanguage(language)
      void buildMenu()
    }
    return true
  })

  ipcMain.handle(IPC.exportHtml, async (_e, html: string, defaultName?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName ?? 'document.html',
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, html, 'utf8')
    return result.filePath
  })

  ipcMain.handle(IPC.exportWord, async (_e, html: string, defaultName?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName ?? 'document.doc',
      filters: [{ name: 'Word', extensions: ['doc'] }]
    })
    if (result.canceled || !result.filePath) return null
    // A UTF-8 HTML file with a .doc extension is opened natively by Word, which
    // is the same lightweight route used for Word export elsewhere.
    await fs.writeFile(result.filePath, `\ufeff${html}`, 'utf8')
    return result.filePath
  })

  ipcMain.handle(IPC.exportPdf, async (_e, html: string, defaultName?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName ?? 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null

    const tmpFile = join(tmpdir(), `scriba-export-${Date.now()}.html`)
    await fs.writeFile(tmpFile, html, 'utf8')

    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
    })
    try {
      await win.loadFile(tmpFile)
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
      })
      await fs.writeFile(result.filePath, pdf)
    } finally {
      win.destroy()
      fs.unlink(tmpFile).catch(() => undefined)
    }
    return result.filePath
  })

  ipcMain.handle(IPC.exportText, async (_e, text: string, defaultName?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName ?? 'document.txt',
      filters: [
        { name: 'Plain Text', extensions: ['txt'] },
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, text, 'utf8')
    return result.filePath
  })

  ipcMain.handle(IPC.printDocument, async (_e, html: string) => {
    const tmpFile = join(tmpdir(), `scriba-print-${Date.now()}.html`)
    await fs.writeFile(tmpFile, html, 'utf8')

    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
    })
    try {
      await win.loadFile(tmpFile)
      return await new Promise<boolean>((resolve) => {
        win.webContents.print({ printBackground: true }, (success) => resolve(success))
      })
    } finally {
      win.destroy()
      fs.unlink(tmpFile).catch(() => undefined)
    }
  })

  ipcMain.handle(
    IPC.exportEpub,
    async (
      _e,
      payload: { title: string; xhtml: string; css: string; docPath?: string | null },
      defaultName?: string
    ) => {
      const result = await dialog.showSaveDialog({
        defaultPath: defaultName ?? 'document.epub',
        filters: [{ name: 'EPUB', extensions: ['epub'] }]
      })
      if (result.canceled || !result.filePath) return null
      await writeEpub(
        {
          title: payload.title,
          xhtml: payload.xhtml,
          css: payload.css,
          docPath: payload.docPath ?? null
        },
        result.filePath
      )
      return result.filePath
    }
  )

  ipcMain.handle(IPC.exportLatex, async (_e, latex: string, defaultName?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName ?? 'document.tex',
      filters: [
        { name: 'LaTeX', extensions: ['tex'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, latex, 'utf8')
    return result.filePath
  })

  /**
   * Renders the export page offscreen and captures it as a PNG. The page is sized
   * to its full content height so the image is not cut off at one viewport.
   */
  ipcMain.handle(IPC.exportImage, async (_e, html: string, defaultName?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName ?? 'document.png',
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })
    if (result.canceled || !result.filePath) return null

    const tmpFile = join(tmpdir(), `scriba-image-${Date.now()}.html`)
    await fs.writeFile(tmpFile, html, 'utf8')

    const win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 1400,
      webPreferences: { sandbox: true, contextIsolation: true, javascript: true }
    })
    try {
      await win.loadFile(tmpFile)
      const height = await win.webContents.executeJavaScript(
        'Math.ceil(document.documentElement.scrollHeight)'
      )
      if (typeof height === 'number' && height > 0) {
        win.setContentSize(1000, Math.min(height, 20000))
      }
      const image = await win.webContents.capturePage()
      await fs.writeFile(result.filePath, image.toPNG())
    } finally {
      win.destroy()
      fs.unlink(tmpFile).catch(() => undefined)
    }
    return result.filePath
  })

  ipcMain.handle(IPC.setSpellcheck, async (e, enabled: boolean) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win || win.isDestroyed()) return false
    try {
      // The spellchecker lives on the session, which is shared by every window of
      // this app, so toggling it here affects the editor immediately.
      const session = win.webContents.session
      session.setSpellCheckerEnabled(Boolean(enabled))

      if (enabled) {
        // Without an explicit language list Chromium falls back to the OS locale.
        // Chinese has no bundled dictionary at all (Chromium ships 56 languages and
        // zh is not among them), so on a Chinese system nothing would be flagged.
        // Prefer the interface language, then the OS locale, then English.
        const available = session.availableSpellCheckerLanguages
        const candidates: string[] = []
        for (const raw of [getMainLanguage(), app.getLocale(), 'en-US', 'en-GB']) {
          const id = (raw ?? '').toLowerCase()
          if (!id) continue
          candidates.push(id)
          // `zh-CN` should also try the bare `zh` form and vice versa.
          if (id.includes('-')) candidates.push(id.split('-')[0])
          else candidates.push(`${id}-us`, `${id}-gb`)
        }

        const chosen = candidates.find((id) =>
          available.some((lang) => lang.toLowerCase() === id)
        )
        if (chosen) {
          const exact = available.find((lang) => lang.toLowerCase() === chosen)
          if (exact) session.setSpellCheckerLanguages([exact])
        }
      }
      return true
    } catch {
      return false
    }
  })

  /** Languages the bundled spellchecker can actually use, for the settings UI. */
  ipcMain.handle(IPC.spellcheckLanguages, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win || win.isDestroyed()) return []
    try {
      return win.webContents.session.availableSpellCheckerLanguages
    } catch {
      return []
    }
  })

  /**
   * Exports a whole folder: the user picks a destination directory, then every
   * Markdown file and asset under the source is copied there. Returns null when the
   * user cancels the dialog.
   */
  ipcMain.handle(
    IPC.exportFolder,
    async (_e, source: string, extensions?: string[]) => {
      const stat = await fs.stat(source).catch(() => null)
      if (!stat?.isDirectory()) return null

      const result = await dialog.showOpenDialog({
        title: 'Choose export destination',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: join(source, '..', suggestedExportName(source))
      })
      if (result.canceled || result.filePaths.length === 0) return null

      // Export into a subfolder of the chosen directory so an existing folder is
      // never overwritten by accident.
      const destination = join(result.filePaths[0], suggestedExportName(source))
      return exportFolder({ source, destination, extensions })
    }
  )

  ipcMain.handle(IPC.recentFiles, async () => readRecent())

  ipcMain.handle(IPC.addRecentFile, async (_e, filePath: string) => {
    if (!filePath) return readRecent()
    const list = await readRecent()
    const next = [filePath, ...list.filter((item) => item !== filePath)].slice(0, MAX_RECENT)
    await writeRecent(next)
    return next
  })

  ipcMain.handle(IPC.clearRecentFiles, async () => {
    await writeRecent([])
    return []
  })

  ipcMain.handle(IPC.refreshMenu, async () => {
    await buildMenu()
    return true
  })

  ipcMain.on(IPC.windowMinimize, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })
  ipcMain.on(IPC.windowMaximize, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC.windowClose, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })
  ipcMain.handle(IPC.windowIsMaximized, (e) => {
    return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false
  })

  // The Windows title-bar overlay (minimise/maximise/close) is drawn by the OS, so it
  // cannot read CSS variables: it has to be repainted whenever the theme changes or the
  // buttons keep the previous theme's colour.
  ipcMain.on(IPC.setTitleBarTheme, (e, colors: { background?: string; symbol?: string }) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win || process.platform !== 'win32') return
    const background = typeof colors?.background === 'string' ? colors.background : null
    const symbol = typeof colors?.symbol === 'string' ? colors.symbol : null
    if (!background || !symbol) return
    try {
      win.setTitleBarOverlay({ color: background, symbolColor: symbol, height: 40 })
    } catch {
      // setTitleBarOverlay throws when the window has no overlay (non-Windows builds).
    }
  })
}
