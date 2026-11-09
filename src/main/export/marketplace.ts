import { net } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type {
  MarketplaceEntry,
  MarketplaceIndex,
  MarketplaceInstallResult,
  PluginManifest
} from '../../shared/types'
import { isCompatible } from '../../shared/version'
import { MarketplaceError, parseIndex } from '../../shared/marketplace'
import { findPluginRoot, readZip, ZipError } from './unzip'

/**
 * Plugin marketplace: fetches a JSON index, downloads plugin archives and installs
 * them into the user plugin directory.
 *
 * The index is just a URL, so the project ships no hard dependency on a specific
 * registry — a fork or a private deployment can point at its own index.
 */

export { MarketplaceError, parseIndex }

/** Upper bound on the index document, so a hostile server cannot exhaust memory. */
const MAX_INDEX_BYTES = 2 * 1024 * 1024

/** Upper bound on a plugin archive. */
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024

/** Reads a response body with a hard size cap. */
async function readCapped(response: Response, maxBytes: number, what: string): Promise<Buffer> {
  const length = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(length) && length > maxBytes) {
    throw new MarketplaceError(`${what} is larger than the allowed size`)
  }
  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > maxBytes) {
    throw new MarketplaceError(`${what} is larger than the allowed size`)
  }
  return Buffer.from(arrayBuffer)
}

/** Fetches and parses the marketplace index. */
export async function fetchIndex(url: string): Promise<MarketplaceIndex> {
  if (!/^https?:\/\//i.test(url)) {
    throw new MarketplaceError('Index URL must start with http:// or https://')
  }

  let response: Response
  try {
    response = await net.fetch(url, { headers: { accept: 'application/json' } })
  } catch (error) {
    throw new MarketplaceError(
      `Could not reach the marketplace: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!response.ok) {
    throw new MarketplaceError(`Marketplace responded with HTTP ${response.status}`)
  }

  const buffer = await readCapped(response, MAX_INDEX_BYTES, 'Index')
  let raw: unknown
  try {
    raw = JSON.parse(buffer.toString('utf8'))
  } catch {
    throw new MarketplaceError('Index is not valid JSON')
  }

  return parseIndex(raw, url)
}

/** Downloads a plugin archive. */
async function downloadArchive(url: string): Promise<Buffer> {
  if (!/^https?:\/\//i.test(url)) {
    throw new MarketplaceError('Download URL must start with http:// or https://')
  }
  let response: Response
  try {
    response = await net.fetch(url, { redirect: 'follow' })
  } catch (error) {
    throw new MarketplaceError(
      `Download failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (!response.ok) {
    throw new MarketplaceError(`Download responded with HTTP ${response.status}`)
  }
  return readCapped(response, MAX_ARCHIVE_BYTES, 'Plugin archive')
}

/**
 * Installs a plugin from the marketplace.
 *
 * Steps: download → unzip → locate the manifest → verify the id matches the index
 * entry → copy into `<userData>/plugins/<id>`.
 *
 * The plugin is written to a temporary directory first and moved into place only
 * after it validates, so a failed install never leaves a half-written plugin.
 */
export async function installFromMarketplace(
  entry: MarketplaceEntry,
  pluginsDir: string,
  appVersion: string
): Promise<MarketplaceInstallResult> {
  if (!isCompatible({ minAppVersion: entry.minAppVersion }, appVersion)) {
    throw new MarketplaceError(
      `This plugin requires Scriba ${entry.minAppVersion} or newer`
    )
  }

  const archive = await downloadArchive(entry.download)

  let entries
  try {
    entries = readZip(archive)
  } catch (error) {
    throw new MarketplaceError(
      error instanceof ZipError ? error.message : 'Could not read the plugin archive'
    )
  }

  const root = findPluginRoot(entries)
  if (root === null) {
    throw new MarketplaceError('The archive does not contain a manifest.json')
  }

  const prefix = root === '' ? '' : `${root}/`
  const manifestEntry = entries.find(
    (item) => !item.isDirectory && item.name === `${prefix}manifest.json`
  )
  if (!manifestEntry) {
    throw new MarketplaceError('The archive does not contain a manifest.json')
  }

  let manifest: PluginManifest
  try {
    manifest = JSON.parse(manifestEntry.data.toString('utf8')) as PluginManifest
  } catch {
    throw new MarketplaceError('manifest.json is not valid JSON')
  }
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new MarketplaceError('manifest.json is missing required fields')
  }
  // The archive must contain the plugin the index advertised; otherwise a stale or
  // swapped download could install something unexpected.
  if (manifest.id !== entry.id) {
    throw new MarketplaceError(
      `Archive contains plugin "${manifest.id}" but "${entry.id}" was requested`
    )
  }

  const target = join(pluginsDir, manifest.id)
  const staging = `${target}.installing`

  await fs.mkdir(pluginsDir, { recursive: true })
  await fs.rm(staging, { recursive: true, force: true })
  await fs.mkdir(staging, { recursive: true })

  try {
    for (const item of entries) {
      if (item.isDirectory) continue
      if (prefix && !item.name.startsWith(prefix)) continue
      const relative = prefix ? item.name.slice(prefix.length) : item.name
      if (!relative) continue

      const destination = join(staging, relative)
      // Defense in depth: `readZip` already rejects traversal, but re-check that the
      // resolved path stays inside the staging directory.
      if (!destination.startsWith(staging)) {
        throw new MarketplaceError('Archive contains an unsafe path')
      }
      await fs.mkdir(join(destination, '..'), { recursive: true })
      await fs.writeFile(destination, item.data)
    }

    await fs.rm(target, { recursive: true, force: true })
    await fs.rename(staging, target)
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined)
    throw error instanceof MarketplaceError
      ? error
      : new MarketplaceError(
          `Could not write the plugin: ${error instanceof Error ? error.message : String(error)}`
        )
  }

  return { id: manifest.id, version: manifest.version, dir: target }
}
