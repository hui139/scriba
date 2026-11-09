import type { MarketplaceEntry, MarketplaceIndex } from './types'

/**
 * Marketplace index parsing, kept free of Electron imports so the rules can be unit
 * tested and reused without booting the main process.
 */

/** Format version this client understands. */
export const SUPPORTED_INDEX_VERSION = 1

export class MarketplaceError extends Error {}

/** Validates and normalizes a marketplace index document. */
export function parseIndex(raw: unknown, source?: string): MarketplaceIndex {
  if (!raw || typeof raw !== 'object') {
    throw new MarketplaceError('Index is not a JSON object')
  }
  const document = raw as Record<string, unknown>

  const version = typeof document.version === 'number' ? document.version : SUPPORTED_INDEX_VERSION
  if (version > SUPPORTED_INDEX_VERSION) {
    throw new MarketplaceError(
      `Index format ${version} is newer than this app supports (${SUPPORTED_INDEX_VERSION})`
    )
  }

  if (!Array.isArray(document.plugins)) {
    throw new MarketplaceError('Index has no "plugins" array')
  }

  const plugins: MarketplaceEntry[] = []
  for (const item of document.plugins) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    if (
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      typeof entry.version !== 'string' ||
      typeof entry.download !== 'string'
    ) {
      // A malformed entry is skipped rather than breaking the whole list.
      continue
    }
    // Only http(s) downloads: a `file://` or `javascript:` URL must never be fetched.
    if (!/^https?:\/\//i.test(entry.download)) continue

    plugins.push({
      id: entry.id,
      name: entry.name,
      version: entry.version,
      download: entry.download,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      author: typeof entry.author === 'string' ? entry.author : undefined,
      license: typeof entry.license === 'string' ? entry.license : undefined,
      homepage: typeof entry.homepage === 'string' ? entry.homepage : undefined,
      repository: typeof entry.repository === 'string' ? entry.repository : undefined,
      minAppVersion: typeof entry.minAppVersion === 'string' ? entry.minAppVersion : undefined,
      keywords: Array.isArray(entry.keywords)
        ? entry.keywords.filter((k): k is string => typeof k === 'string')
        : undefined
    })
  }

  return { version, source, plugins }
}
