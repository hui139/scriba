import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, dirname, extname, join, normalize, resolve, sep } from 'node:path'
import chokidar, { FSWatcher } from 'chokidar'
import { IPC } from '../../shared/ipc'
import type {
  FileNode,
  FilePayload,
  FsChangeEvent,
  SearchFileResult,
  SearchMatch,
  SearchOptions
} from '../../shared/types'
import { mt } from '../i18n'
import { relativeLink, rewriteLinks } from '../links'

const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'out',
  'release',
  '.DS_Store',
  'Thumbs.db'
])

const MAX_FILE_SIZE = 20 * 1024 * 1024
// Inline limit for export embedding: keeps exported files reasonable while still
// covering normal screenshots and diagrams.
const MAX_IMAGE_EMBED = 12 * 1024 * 1024
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'])
const watchers = new Map<string, FSWatcher>()

async function walk(dir: string, depth = 0): Promise<FileNode[]> {
  if (depth > 16) return []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes: FileNode[] = []
  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name)) continue
    if (entry.name.startsWith('.') && entry.name !== '.scriba') continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: true,
        children: await walk(fullPath, depth + 1)
      })
    } else if (entry.isFile()) {
      nodes.push({ name: entry.name, path: fullPath, isDirectory: false })
    }
  }

  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  return nodes
}

function assertInside(base: string, target: string): void {
  const baseNorm = resolve(base) + sep
  const targetNorm = resolve(target)
  if (!targetNorm.startsWith(baseNorm) && targetNorm !== resolve(base)) {
    throw new Error(mt('error.pathEscapes'))
  }
}

function validateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error(mt('error.nameEmpty'))
  if (/[\\/:*?"<>|]/.test(trimmed)) throw new Error(mt('error.nameInvalidChars'))
  if (trimmed === '.' || trimmed === '..') throw new Error(mt('error.nameInvalid'))
  return trimmed
}

export function registerFileIpc(): void {
  ipcMain.handle(IPC.openFolder, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    const root = result.filePaths[0]
    return { path: root, tree: await walk(root) }
  })

  ipcMain.handle(IPC.openFiles, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: mt('dialog.markdownFiles'), extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
        { name: mt('dialog.allFiles'), extensions: ['*'] }
      ]
    })
    if (result.canceled) return []
    return Promise.all(result.filePaths.map((p) => readPayload(p)))
  })

  ipcMain.handle(IPC.saveAs, async (_e, defaultPath?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultPath ?? 'untitled.md',
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle(IPC.readDir, async (_e, dir: string) => {
    return walk(dir)
  })

  ipcMain.handle(IPC.readFile, async (_e, filePath: string) => {
    return readPayload(filePath)
  })

  ipcMain.handle(IPC.writeFile, async (_e, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf8')
    const stat = await fs.stat(filePath)
    return { path: filePath, mtimeMs: stat.mtimeMs }
  })

  // Images pasted from the clipboard are written next to the document (in an
  // `assets` folder) and linked with a relative path. Unsaved documents fall back
  // to the app data folder and an absolute path.
  ipcMain.handle(
    IPC.savePastedImage,
    async (_e, docPath: string | null, data: Uint8Array, extension: string) => {
      const ext = IMAGE_EXTENSIONS.has(extension.toLowerCase())
        ? extension.toLowerCase()
        : 'png'
      const dir = docPath
        ? join(dirname(docPath), 'assets')
        : join(app.getPath('userData'), 'pasted-images')
      await fs.mkdir(dir, { recursive: true })

      const name = `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const target = join(dir, name)
      await fs.writeFile(target, Buffer.from(data))
      return {
        path: target,
        markdownPath: docPath ? `assets/${name}` : target.replace(/\\/g, '/')
      }
    }
  )

  ipcMain.handle(IPC.createEntry, async (_e, parentDir: string, name: string, isDirectory: boolean) => {
    const safeName = validateName(name)
    const target = join(parentDir, safeName)
    assertInside(parentDir, target)
    if (isDirectory) {
      await fs.mkdir(target, { recursive: false })
    } else {
      const withExt = extname(safeName) ? safeName : `${safeName}.md`
      const filePath = join(parentDir, withExt)
      await fs.writeFile(filePath, '', { encoding: 'utf8', flag: 'wx' })
      return filePath
    }
    return target
  })

  ipcMain.handle(IPC.renameEntry, async (_e, oldPath: string, newName: string, updateLinks = true) => {
    const safeName = validateName(newName)
    const target = join(dirname(oldPath), safeName)
    assertInside(dirname(oldPath), target)
    await fs.rename(oldPath, target)

    // Updating references is best-effort: a failure here must not undo the rename.
    let updated = 0
    if (updateLinks) {
      try {
        updated = await updateReferences(oldPath, target)
      } catch {
        updated = 0
      }
    }
    return { path: target, updatedReferences: updated }
  })

  ipcMain.handle(IPC.deleteEntry, async (_e, targetPath: string) => {
    await shell.trashItem(targetPath)
    return true
  })

  ipcMain.handle(IPC.pathExists, async (_e, targetPath: string) => {
    try {
      await fs.access(targetPath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(IPC.watchFolder, async (e, dir: string) => {
    if (watchers.has(dir)) return true
    const win = BrowserWindow.fromWebContents(e.sender)
    const watcher = chokidar.watch(dir, {
      ignored: (p: string) => {
        const base = basename(p)
        return IGNORED_NAMES.has(base) || (base.startsWith('.') && base !== '.scriba')
      },
      ignoreInitial: true,
      depth: 16,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 30 }
    })
    const emit = (type: FsChangeEvent['type'], p: string): void => {
      win?.webContents.send(IPC.fsChanged, { type, path: normalize(p) })
    }
    watcher.on('add', (p) => emit('add', p))
    watcher.on('change', (p) => emit('change', p))
    watcher.on('unlink', (p) => emit('unlink', p))
    watcher.on('addDir', (p) => emit('addDir', p))
    watcher.on('unlinkDir', (p) => emit('unlinkDir', p))
    watchers.set(dir, watcher)
    return true
  })

  ipcMain.handle(IPC.unwatchFolder, async (_e, dir: string) => {
    const watcher = watchers.get(dir)
    if (watcher) {
      await watcher.close()
      watchers.delete(dir)
    }
    return true
  })

  ipcMain.handle(IPC.showItemInFolder, async (_e, targetPath: string) => {
    shell.showItemInFolder(targetPath)
    return true
  })

  /**
   * Reads an image referenced from a document and returns it as a data URI.
   *
   * Exported HTML/PDF/Word files are written outside the workspace, so a relative
   * `![](assets/x.png)` link would break. Inlining the bytes keeps every export
   * self-contained, which is what PDF and Word output require.
   */
  ipcMain.handle(
    IPC.readImageDataUri,
    async (_e, docPath: string | null, src: string): Promise<string | null> => {
      if (!src || /^(?:data:|https?:|blob:|scriba-media:)/i.test(src)) return null

      const candidates: string[] = []
      const decoded = decodeURI(src.replace(/^file:\/\//i, ''))
      if (/^[a-zA-Z]:[\\/]/.test(decoded) || decoded.startsWith('/')) {
        candidates.push(decoded)
      } else if (docPath) {
        candidates.push(join(dirname(docPath), decoded))
      }

      for (const candidate of candidates) {
        try {
          const stat = await fs.stat(candidate)
          if (!stat.isFile() || stat.size > MAX_IMAGE_EMBED) continue
          const buffer = await fs.readFile(candidate)
          return `data:${mimeFor(candidate)};base64,${buffer.toString('base64')}`
        } catch {
          continue
        }
      }
      return null
    }
  )

  ipcMain.handle(IPC.searchWorkspace, async (_e, root: string, options: SearchOptions) => {
    return searchWorkspace(root, options)
  })
}

const TEXT_EXTENSIONS = new Set([
  'md',
  'markdown',
  'mdown',
  'mkd',
  'mdx',
  'txt',
  'text'
])

/** Builds the regular expression used for one search, or null when invalid. */
function buildSearchRegExp(options: SearchOptions): RegExp | null {
  const raw = options.query
  if (!raw) return null

  let source = options.regexp ? raw : raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // `\b` alone still matches across hyphens ("alpha-beta"), so whole-word uses
  // explicit lookarounds to require a real word boundary on both sides.
  if (options.wholeWord) source = `(?<![\\w-])(?:${source})(?![\\w-])`

  const flags = options.caseSensitive ? 'g' : 'gi'
  try {
    return new RegExp(source, flags)
  } catch {
    // An invalid pattern is reported by returning no results rather than throwing,
    // so the panel can keep the user's text on screen while they finish typing.
    return null
  }
}

/**
 * Walks the workspace and returns files whose contents match, with up to
 * MAX_MATCHES_PER_FILE matching lines each.
 *
 * The walk is breadth-limited by `limit` files so a large repository cannot stall
 * the UI; the renderer reports when the cap was reached.
 */
async function searchWorkspace(root: string, options: SearchOptions): Promise<SearchFileResult[]> {
  const pattern = buildSearchRegExp(options)
  if (!pattern) return []

  const limit = options.limit ?? 200
  const results: SearchFileResult[] = []
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]

  while (queue.length > 0 && results.length < limit) {
    const { dir, depth } = queue.shift()!
    if (depth > 16) continue

    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (results.length >= limit) break
      if (IGNORED_NAMES.has(entry.name)) continue
      if (entry.name.startsWith('.') && entry.name !== '.scriba') continue

      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        queue.push({ dir: fullPath, depth: depth + 1 })
        continue
      }
      if (!entry.isFile()) continue

      const ext = extname(entry.name).replace('.', '').toLowerCase()
      if (!TEXT_EXTENSIONS.has(ext)) continue

      let content: string
      try {
        const stat = await fs.stat(fullPath)
        if (stat.size > MAX_FILE_SIZE) continue
        content = await fs.readFile(fullPath, 'utf8')
      } catch {
        continue
      }

      const matches = collectMatches(content, pattern)
      if (matches.length === 0) continue

      results.push({
        path: fullPath,
        name: entry.name,
        relative: relativeTo(root, fullPath),
        matches
      })
    }
  }

  return results
}

const MAX_MATCHES_PER_FILE = 50

/**
 * Scans the workspace for Markdown links pointing at `oldPath` and rewrites them
 * to ``newPath`` so links do not break when a document is renamed.
 *
 * Returns the number of references changed. Files that cannot be read or written
 * are skipped rather than aborting the whole operation.
 */
async function updateReferences(oldPath: string, newPath: string): Promise<number> {
  const root = findWorkspaceRoot(oldPath)
  if (!root) return 0

  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  let changed = 0

  while (queue.length > 0) {
    const { dir, depth } = queue.shift()!
    if (depth > 16) continue

    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name)) continue
      if (entry.name.startsWith('.') && entry.name !== '.scriba') continue

      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        queue.push({ dir: fullPath, depth: depth + 1 })
        continue
      }
      if (!entry.isFile()) continue
      if (!/\.(md|markdown|mdown|mkd|mdx)$/i.test(entry.name)) continue
      if (fullPath === newPath) continue

      let content: string
      try {
        const stat = await fs.stat(fullPath)
        if (stat.size > MAX_FILE_SIZE) continue
        content = await fs.readFile(fullPath, 'utf8')
      } catch {
        continue
      }

      // Links are written relative to the referring file's own directory.
      const oldRelative = relativeLink(dirname(fullPath), oldPath)
      const newRelative = relativeLink(dirname(fullPath), newPath)
      if (oldRelative === newRelative) continue

      const result = rewriteLinks(content, oldRelative, newRelative)
      if (result.replacements === 0) continue

      try {
        await fs.writeFile(fullPath, result.content, 'utf8')
        changed += result.replacements
      } catch {
        // Leave the file untouched if it cannot be written.
      }
    }
  }

  return changed
}

/**
 * Walks up from a file to the nearest directory that looks like a workspace root.
 *
 * Scriba has no explicit project marker, so the containing directory is used as
 * the search scope. That keeps the scan bounded instead of crawling the drive.
 */
function findWorkspaceRoot(filePath: string): string | null {
  return dirname(filePath) || null
}

/** Finds matching lines in a file, capped so one huge file cannot dominate. */
function collectMatches(content: string, pattern: RegExp): SearchMatch[] {
  const lines = content.split(/\r?\n/)
  const matches: SearchMatch[] = []

  for (let index = 0; index < lines.length; index++) {
    if (matches.length >= MAX_MATCHES_PER_FILE) break
    const line = lines[index]
    // `lastIndex` is shared by the global regex, so reset it per line.
    pattern.lastIndex = 0
    const found = pattern.exec(line)
    if (!found) continue

    // `text` is trimmed for display, so shift the match offset by however much was
    // removed from the front; otherwise the highlight lands on the wrong characters.
    const leading = line.length - line.trimStart().length
    const text = line.trim()
    const start = Math.max(0, found.index - leading)
    // A match that began inside the trimmed whitespace cannot be placed in `text`.
    if (start + found[0].length > text.length) {
      matches.push({ line: index + 1, text, start: 0, length: 0 })
      continue
    }

    matches.push({
      line: index + 1,
      text,
      start,
      length: found[0].length
    })
  }

  return matches
}

function relativeTo(root: string, target: string): string {
  const base = resolve(root)
  const full = resolve(target)
  if (!full.startsWith(base)) return target
  return full.slice(base.length).replace(/^[\\/]+/, '').replace(/\\/g, '/')
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon'
}

function mimeFor(filePath: string): string {
  const ext = extname(filePath).replace('.', '').toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

async function readPayload(filePath: string): Promise<FilePayload> {
  const stat = await fs.stat(filePath)
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File is too large (${Math.round(stat.size / 1024 / 1024)}MB)`)
  }
  const content = await fs.readFile(filePath, 'utf8')
  return { path: filePath, content, mtimeMs: stat.mtimeMs }
}
