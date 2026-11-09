import { promises as fs } from 'node:fs'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'

/**
 * Folder export: copies a whole workspace folder — Markdown documents, their
 * referenced images and any other assets — into a destination directory.
 *
 * A plain recursive copy is the honest interpretation of "export the folder": the
 * result opens in any Markdown editor with its images intact. Optionally each
 * Markdown file can also be rendered to a second format (handled by the caller,
 * which passes a converter).
 */

/** Directories that never belong in an export. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'out',
  'release',
  '.vscode',
  '.idea',
  '.DS_Store'
])

export interface FolderExportOptions {
  /** Folder to copy. */
  source: string
  /** Destination directory; created if missing. */
  destination: string
  /** File extensions to include (lowercase, without the dot). Empty means all. */
  extensions?: string[]
  /** Skip files larger than this many bytes (default 50 MB). */
  maxFileSize?: number
  /** Maximum directory depth, to avoid pathological trees (default 16). */
  maxDepth?: number
}

export interface FolderExportResult {
  /** Destination root actually written. */
  destination: string
  filesCopied: number
  bytesCopied: number
  /** Directories that were skipped by name. */
  skippedDirs: string[]
  /** Files skipped because they were too large. */
  skippedLarge: number
  /** True when the depth limit stopped the walk. */
  truncated: boolean
}

function isInside(base: string, target: string): boolean {
  const baseNorm = resolve(base) + sep
  const targetNorm = resolve(target)
  return targetNorm === resolve(base) || targetNorm.startsWith(baseNorm)
}

/**
 * Copies `options.source` into `options.destination`.
 *
 * Refuses to write inside the source folder, which would otherwise copy the export
 * into itself on the next run.
 */
export async function exportFolder(options: FolderExportOptions): Promise<FolderExportResult> {
  const source = resolve(options.source)
  const destination = resolve(options.destination)
  const maxSize = options.maxFileSize ?? 50 * 1024 * 1024
  const maxDepth = options.maxDepth ?? 16
  const allowed = options.extensions?.map((ext) => ext.toLowerCase().replace(/^\./, '')) ?? []

  const stat = await fs.stat(source).catch(() => null)
  if (!stat?.isDirectory()) {
    throw new Error(`Not a folder: ${source}`)
  }
  if (isInside(source, destination)) {
    throw new Error('The destination cannot be inside the folder being exported')
  }

  const result: FolderExportResult = {
    destination,
    filesCopied: 0,
    bytesCopied: 0,
    skippedDirs: [],
    skippedLarge: 0,
    truncated: false
  }

  await fs.mkdir(destination, { recursive: true })

  const walk = async (dir: string, relative: string, depth: number): Promise<void> => {
    if (depth > maxDepth) {
      result.truncated = true
      return
    }

    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = relative ? join(relative, entry.name) : entry.name

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) {
          result.skippedDirs.push(relPath)
          continue
        }
        await fs.mkdir(join(destination, relPath), { recursive: true })
        await walk(fullPath, relPath, depth + 1)
        continue
      }

      if (!entry.isFile()) continue

      const ext = extname(entry.name).replace('.', '').toLowerCase()
      if (allowed.length > 0 && !allowed.includes(ext)) continue

      try {
        const fileStat = await fs.stat(fullPath)
        if (fileStat.size > maxSize) {
          result.skippedLarge += 1
          continue
        }
        const targetDir = dirname(join(destination, relPath))
        await fs.mkdir(targetDir, { recursive: true })
        await fs.copyFile(fullPath, join(destination, relPath))
        result.filesCopied += 1
        result.bytesCopied += fileStat.size
      } catch {
        // A single unreadable file must not abort the whole export.
      }
    }
  }

  await walk(source, '', 0)
  return result
}

/** Extensions considered Markdown documents. */
export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'mdx']

/** Suggested destination folder name for a source folder. */
export function suggestedExportName(source: string): string {
  return `${basename(source)}-export`
}
