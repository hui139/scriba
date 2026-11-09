import { net } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type {
  GithubPluginResult,
  GithubSearchResult,
  MarketplaceInstallResult,
  PluginManifest
} from '../../shared/types'
import {
  MANIFEST_PATHS,
  PLUGIN_TOPIC,
  idFromRepoName,
  validateManifest
} from '../../shared/pluginSpec'
import { isCompatible } from '../../shared/version'
import { findPluginRoot, readZip, ZipError } from './unzip'

/**
 * GitHub-backed plugin discovery.
 *
 * Discovery uses GitHub's repository search filtered by the `scriba-plugin` topic,
 * so publishing a plugin needs nothing more than a public repository with that
 * topic. Installation downloads the repository archive, which means no release
 * assets or index files have to be maintained.
 *
 * An optional token raises the API rate limit; without one GitHub allows 10 search
 * requests per minute for unauthenticated clients.
 */

const API_BASE = 'https://api.github.com'
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024

export class GithubError extends Error {
  constructor(
    message: string,
    readonly rateLimited = false
  ) {
    super(message)
  }
}

function headers(token?: string): Record<string, string> {
  const result: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'Scriba-Plugin-Marketplace'
  }
  if (token && token.trim()) result.authorization = `Bearer ${token.trim()}`
  return result
}

async function getJson(url: string, token?: string): Promise<unknown> {
  let response: Response
  try {
    response = await net.fetch(url, { headers: headers(token) })
  } catch (error) {
    throw new GithubError(
      `Could not reach GitHub: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  // GitHub signals rate limiting with 403/429 plus a zero remaining count.
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      throw new GithubError('GitHub API rate limit reached. Try again later or add a token.', true)
    }
    throw new GithubError(`GitHub refused the request (HTTP ${response.status})`)
  }
  if (response.status === 404) throw new GithubError('Not found on GitHub')
  if (!response.ok) throw new GithubError(`GitHub responded with HTTP ${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_RESPONSE_BYTES) throw new GithubError('GitHub response was too large')
  try {
    return JSON.parse(buffer.toString('utf8'))
  } catch {
    throw new GithubError('GitHub returned invalid JSON')
  }
}

/** Reads raw file text from a repository, returning null when absent. */
async function getRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token?: string
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
  try {
    const response = await net.fetch(url, { headers: headers(token) })
    if (!response.ok) return null
    const text = await response.text()
    // A raw manifest is small; anything huge is not a manifest.
    return text.length > 256 * 1024 ? null : text
  } catch {
    return null
  }
}

/** Fetches and validates the manifest of a repository, trying known locations. */
async function fetchManifest(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<{ manifest?: PluginManifest; problem?: string }> {
  for (const path of MANIFEST_PATHS) {
    const text = await getRawFile(owner, repo, branch, path, token)
    if (!text) continue

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { problem: `${path} is not valid JSON` }
    }

    const issues = validateManifest(parsed)
    if (issues.length > 0) {
      return { problem: issues.map((issue) => issue.message).join('; ') }
    }
    return { manifest: parsed as PluginManifest }
  }
  return { problem: 'No manifest.json found in the repository root' }
}

/**
 * Searches GitHub for plugin repositories.
 *
 * `query` is free text from the user; it is combined with the required topic so
 * only repositories that opted into the marketplace appear.
 */
export async function searchGithubPlugins(
  query: string,
  options: { token?: string; perPage?: number; fetchManifests?: boolean } = {}
): Promise<GithubSearchResult> {
  const perPage = Math.min(Math.max(options.perPage ?? 20, 1), 50)
  const terms = [`topic:${PLUGIN_TOPIC}`]
  const trimmed = query.trim()
  if (trimmed) terms.push(trimmed)

  const url = `${API_BASE}/search/repositories?q=${encodeURIComponent(
    terms.join(' ')
  )}&sort=stars&order=desc&per_page=${perPage}`

  const raw = (await getJson(url, options.token)) as {
    total_count?: number
    items?: unknown[]
  }

  const items = Array.isArray(raw.items) ? raw.items : []
  const results: GithubPluginResult[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const repo = item as Record<string, unknown>
    const fullName = typeof repo.full_name === 'string' ? repo.full_name : null
    if (!fullName || !fullName.includes('/')) continue

    const [owner, name] = fullName.split('/')
    const defaultBranch = typeof repo.default_branch === 'string' ? repo.default_branch : 'main'
    const idHint = idFromRepoName(name)

    results.push({
      fullName,
      owner,
      repo: name,
      description: typeof repo.description === 'string' ? repo.description : undefined,
      stars: typeof repo.stargazers_count === 'number' ? repo.stargazers_count : 0,
      updatedAt: typeof repo.updated_at === 'string' ? repo.updated_at : '',
      topics: Array.isArray(repo.topics)
        ? repo.topics.filter((t): t is string => typeof t === 'string')
        : [],
      htmlUrl: typeof repo.html_url === 'string' ? repo.html_url : `https://github.com/${fullName}`,
      defaultBranch,
      followsNaming: idHint !== null,
      idHint: idHint ?? undefined
    })
  }

  // Manifests are fetched in parallel; a failure marks that one result rather than
  // failing the whole search.
  if (options.fetchManifests !== false) {
    await Promise.all(
      results.map(async (result) => {
        const { manifest, problem } = await fetchManifest(
          result.owner,
          result.repo,
          result.defaultBranch,
          options.token
        )
        result.manifest = manifest
        result.problem = problem
      })
    )
  }

  return {
    items: results,
    totalCount: typeof raw.total_count === 'number' ? raw.total_count : results.length
  }
}

/** Downloads a repository's source archive for the given ref. */
async function downloadRepoArchive(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<Buffer> {
  const url = `${API_BASE}/repos/${owner}/${repo}/zipball/${encodeURIComponent(branch)}`
  let response: Response
  try {
    response = await net.fetch(url, { headers: headers(token), redirect: 'follow' })
  } catch (error) {
    throw new GithubError(
      `Download failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (!response.ok) throw new GithubError(`Download responded with HTTP ${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_ARCHIVE_BYTES) throw new GithubError('Repository archive is too large')
  return buffer
}

/**
 * Installs a plugin straight from a GitHub repository.
 *
 * The archive GitHub produces wraps everything in a single top-level directory, so
 * the plugin root is located rather than assumed. Installation is staged and then
 * renamed into place, so a failure never leaves a partial plugin behind.
 */
export async function installFromGithub(
  result: GithubPluginResult,
  pluginsDir: string,
  appVersion: string,
  token?: string
): Promise<MarketplaceInstallResult> {
  // Prefer the manifest already fetched during search; fall back to reading it now.
  let manifest = result.manifest
  if (!manifest) {
    const fetched = await fetchManifest(result.owner, result.repo, result.defaultBranch, token)
    if (!fetched.manifest) {
      throw new GithubError(fetched.problem ?? 'This repository is not a Scriba plugin')
    }
    manifest = fetched.manifest
  }

  if (!isCompatible(manifest, appVersion)) {
    throw new GithubError(`This plugin requires Scriba ${manifest.minAppVersion} or newer`)
  }

  const archive = await downloadRepoArchive(result.owner, result.repo, result.defaultBranch, token)

  let entries
  try {
    entries = readZip(archive)
  } catch (error) {
    throw new GithubError(error instanceof ZipError ? error.message : 'Could not read the archive')
  }

  // GitHub archives are `<owner>-<repo>-<sha>/...`; findPluginRoot handles that and
  // also the flat case.
  const root = findPluginRoot(entries)
  if (root === null) throw new GithubError('The archive does not contain a manifest.json')

  const prefix = root === '' ? '' : `${root}/`
  const manifestEntry = entries.find(
    (entry) => !entry.isDirectory && entry.name === `${prefix}manifest.json`
  )
  if (!manifestEntry) throw new GithubError('The archive does not contain a manifest.json')

  let archiveManifest: PluginManifest
  try {
    archiveManifest = JSON.parse(manifestEntry.data.toString('utf8')) as PluginManifest
  } catch {
    throw new GithubError('manifest.json is not valid JSON')
  }
  // The archive must contain the same plugin that was previewed, otherwise the
  // branch changed between search and install.
  if (archiveManifest.id !== manifest.id) {
    throw new GithubError(
      `The repository now contains plugin "${archiveManifest.id}" instead of "${manifest.id}"`
    )
  }

  const target = join(pluginsDir, archiveManifest.id)
  const staging = `${target}.installing`

  await fs.mkdir(pluginsDir, { recursive: true })
  await fs.rm(staging, { recursive: true, force: true })
  await fs.mkdir(staging, { recursive: true })

  try {
    for (const entry of entries) {
      if (entry.isDirectory) continue
      if (prefix && !entry.name.startsWith(prefix)) continue
      const relative = prefix ? entry.name.slice(prefix.length) : entry.name
      if (!relative) continue

      const destination = join(staging, relative)
      if (!destination.startsWith(staging)) {
        throw new GithubError('Archive contains an unsafe path')
      }
      await fs.mkdir(join(destination, '..'), { recursive: true })
      await fs.writeFile(destination, entry.data)
    }

    await fs.rm(target, { recursive: true, force: true })
    await fs.rename(staging, target)
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined)
    throw error instanceof GithubError
      ? error
      : new GithubError(
          `Could not write the plugin: ${error instanceof Error ? error.message : String(error)}`
        )
  }

  return { id: archiveManifest.id, version: archiveManifest.version, dir: target }
}
