import { app, net, shell } from 'electron'
import type { UpdateInfo } from '../shared/types'
import { compareVersions } from '../shared/version'
import { mt } from './i18n'

/**
 * Update checking against GitHub Releases.
 *
 * The check is deliberately read-only: it asks the releases API what the newest published
 * version is and, if it is newer, hands the user a link. Installing is the user's action,
 * which keeps this out of the signing and notarisation requirements an auto-updater would
 * impose and avoids replacing binaries behind the user's back.
 */

/** Owner/repo used for release lookups. Overridable for forks. */
const RELEASE_REPO = process.env['SCRIBA_RELEASE_REPO'] || 'hui139/scriba'

const API_BASE = 'https://api.github.com'
const REQUEST_TIMEOUT_MS = 8000

interface GithubRelease {
  tag_name?: unknown
  html_url?: unknown
  body?: unknown
  draft?: unknown
  prerelease?: unknown
  assets?: unknown
}

/** Strips a leading `v` so `v0.2.0` and `0.2.0` compare equal. */
function normalizeTag(tag: string): string {
  return tag.trim().replace(/^v/i, '')
}

/**
 * Picks the asset that matches this platform.
 *
 * Returns undefined when the release carries no per-platform asset, in which case the
 * caller falls back to the release page.
 */
function pickAsset(release: GithubRelease): string | undefined {
  if (!Array.isArray(release.assets)) return undefined

  const platform = process.platform
  const arch = process.arch
  const matchers: RegExp[] =
    platform === 'win32'
      ? [new RegExp(`win.*${arch}.*\\.exe$`, 'i'), /win.*\.exe$/i]
      : platform === 'darwin'
        ? [new RegExp(`mac.*${arch}.*\\.dmg$`, 'i'), /mac.*\.dmg$/i, /\.dmg$/i]
        : [new RegExp(`${arch}.*\\.AppImage$`, 'i'), /\.AppImage$/i]

  for (const pattern of matchers) {
    for (const asset of release.assets as Array<Record<string, unknown>>) {
      const name = typeof asset?.name === 'string' ? asset.name : ''
      const url = typeof asset?.browser_download_url === 'string' ? asset.browser_download_url : ''
      if (name && url && pattern.test(name)) return url
    }
  }
  return undefined
}

async function fetchLatestRelease(): Promise<GithubRelease | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await net.fetch(`${API_BASE}/repos/${RELEASE_REPO}/releases/latest`, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'Scriba-Update-Check'
      },
      signal: controller.signal
    })

    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`GitHub responded with HTTP ${response.status}`)
    }
    return (await response.json()) as GithubRelease
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Checks for a newer release.
 *
 * Never throws: a failed check reports `available: false` plus an `error` string, because
 * an offline user should not see an error dialog on startup.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion()
  const base: UpdateInfo = { available: false, latestVersion: currentVersion, currentVersion }

  let release: GithubRelease | null
  try {
    release = await fetchLatestRelease()
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      ...base,
      error: aborted ? mt('update.timeout') : mt('update.failed', {
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  if (!release) {
    // No published release yet is a normal state for a young project, not a failure.
    return { ...base, error: mt('update.none') }
  }

  if (release.draft === true) return { ...base, error: mt('update.none') }

  const tag = typeof release.tag_name === 'string' ? release.tag_name : ''
  if (!tag) return { ...base, error: mt('update.none') }

  const latestVersion = normalizeTag(tag)
  const url = typeof release.html_url === 'string' ? release.html_url : undefined
  const notes = typeof release.body === 'string' ? release.body.slice(0, 4000) : undefined

  // compareVersions is numeric, so 0.10.0 correctly sorts above 0.9.0.
  const available = compareVersions(latestVersion, currentVersion) > 0

  return {
    available,
    latestVersion,
    currentVersion,
    url,
    notes,
    assetUrl: available ? pickAsset(release) : undefined
  }
}

/** Opens the release (or a specific asset) in the user's browser. */
export async function openUpdatePage(target?: string): Promise<boolean> {
  const url = target && /^https:\/\//i.test(target) ? target : `https://github.com/${RELEASE_REPO}/releases`
  try {
    await shell.openExternal(url)
    return true
  } catch {
    return false
  }
}
