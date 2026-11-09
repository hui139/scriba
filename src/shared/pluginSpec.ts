/**
 * Plugin naming and packaging rules.
 *
 * These rules are the contract between the app, the marketplace (GitHub search) and
 * plugin authors. Keeping them in one module means the installer, the search results
 * and the settings UI all agree on what a valid plugin looks like.
 */

/** GitHub topic every discoverable plugin repository must carry. */
export const PLUGIN_TOPIC = 'scriba-plugin'

/** Recommended repository name prefix. */
export const REPO_PREFIX = 'scriba-plugin-'

/** Where the manifest may live inside a repository or archive. */
export const MANIFEST_PATHS = ['manifest.json', 'plugin/manifest.json'] as const

/** Identifier rules, expressed once and reused by validation and docs. */
export const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
export const ID_MIN_LENGTH = 3
export const ID_MAX_LENGTH = 64

/**
 * Ids that would collide with built-in commands, themes or storage keys.
 * Reserved so a plugin cannot shadow core behaviour.
 */
const RESERVED_IDS = new Set([
  'core',
  'scriba',
  'app',
  'editor',
  'system',
  'settings',
  'theme',
  'themes',
  'plugin',
  'plugins',
  'marketplace'
])

export interface ValidationIssue {
  field: string
  message: string
}

/**
 * Validates a plugin id.
 *
 * Rules: 3-64 characters, lowercase letters/digits/hyphens, must start and end with
 * an alphanumeric, no consecutive hyphens. Hyphen-separated words are the norm so
 * ids read like `word-count` rather than `WordCount`.
 */
export function validatePluginId(id: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (typeof id !== 'string' || id.length === 0) {
    return [{ field: 'id', message: 'id is required' }]
  }
  if (id.length < ID_MIN_LENGTH) {
    issues.push({ field: 'id', message: `id must be at least ${ID_MIN_LENGTH} characters` })
  }
  if (id.length > ID_MAX_LENGTH) {
    issues.push({ field: 'id', message: `id must be at most ${ID_MAX_LENGTH} characters` })
  }
  if (!ID_PATTERN.test(id)) {
    issues.push({
      field: 'id',
      message: 'id must use lowercase letters, digits and hyphens, and start/end with a letter or digit'
    })
  }
  if (id.includes('--')) {
    issues.push({ field: 'id', message: 'id must not contain consecutive hyphens' })
  }
  if (RESERVED_IDS.has(id)) {
    issues.push({ field: 'id', message: `"${id}" is reserved` })
  }
  return issues
}

/** Validates a semantic version like `1.2.3`, allowing an optional prerelease tag. */
export function validateVersion(version: unknown): ValidationIssue[] {
  if (typeof version !== 'string' || version.length === 0) {
    return [{ field: 'version', message: 'version is required' }]
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    return [{ field: 'version', message: 'version must look like 1.2.3 (semver)' }]
  }
  return []
}

/**
 * Validates a whole manifest.
 *
 * Only the fields that affect installation and display are checked; unknown extra
 * fields are ignored so plugins can carry their own metadata.
 */
export function validateManifest(manifest: unknown): ValidationIssue[] {
  if (!manifest || typeof manifest !== 'object') {
    return [{ field: 'manifest', message: 'manifest must be a JSON object' }]
  }
  const value = manifest as Record<string, unknown>
  const issues: ValidationIssue[] = []

  issues.push(...validatePluginId(value.id))
  issues.push(...validateVersion(value.version))

  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    issues.push({ field: 'name', message: 'name is required' })
  }
  if (value.main !== undefined && typeof value.main !== 'string') {
    issues.push({ field: 'main', message: 'main must be a string' })
  }
  if (value.minAppVersion !== undefined && typeof value.minAppVersion !== 'string') {
    issues.push({ field: 'minAppVersion', message: 'minAppVersion must be a string' })
  }
  if (value.keywords !== undefined) {
    if (!Array.isArray(value.keywords) || value.keywords.some((k) => typeof k !== 'string')) {
      issues.push({ field: 'keywords', message: 'keywords must be an array of strings' })
    }
  }
  if (value.i18n !== undefined) {
    // Malformed localisation is never fatal: the base name/description still renders, so
    // a typo here must not block installation. Report it so the author can fix it.
    if (typeof value.i18n !== 'object' || value.i18n === null || Array.isArray(value.i18n)) {
      issues.push({ field: 'i18n', message: 'i18n must be an object keyed by language tag' })
    } else {
      for (const [tag, entry] of Object.entries(value.i18n as Record<string, unknown>)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          issues.push({ field: `i18n.${tag}`, message: 'must be an object' })
          continue
        }
        const fields = entry as Record<string, unknown>
        for (const key of ['name', 'description'] as const) {
          if (fields[key] !== undefined && typeof fields[key] !== 'string') {
            issues.push({ field: `i18n.${tag}.${key}`, message: 'must be a string' })
          }
        }
      }
    }
  }
  return issues
}

/**
 * Picks the manifest's display strings for a language.
 *
 * Matching order: exact tag (`ja-JP`), then any entry sharing the base language
 * (`ja`), then the manifest's own `name` / `description`. A region-specific entry beats
 * a bare-language one, so `ja-JP` wins over `ja` when both exist.
 */
export function localizeManifest(
  manifest: { name?: string; description?: string; i18n?: Record<string, unknown> },
  language: string
): { name: string; description?: string } {
  const base = { name: manifest.name ?? '', description: manifest.description }
  const table = manifest.i18n
  if (!table || typeof table !== 'object') return base

  const wanted = (language || '').toLowerCase()
  const wantedBase = wanted.split('-')[0]

  const read = (tag: string): { name?: string; description?: string } | null => {
    const entry = table[tag]
    if (!entry || typeof entry !== 'object') return null
    return entry as { name?: string; description?: string }
  }

  const exactKey = Object.keys(table).find((tag) => tag.toLowerCase() === wanted)
  const baseKey = Object.keys(table).find(
    (tag) => tag.toLowerCase() === wantedBase || tag.toLowerCase().split('-')[0] === wantedBase
  )

  const entry = (exactKey && read(exactKey)) || (baseKey && read(baseKey)) || null
  if (!entry) return base

  return {
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : base.name,
    description:
      typeof entry.description === 'string' && entry.description.trim()
        ? entry.description
        : base.description
  }
}

/**
 * Suggested repository name for a plugin id.
 * Used by the docs and by the "publish" hints in the UI.
 */
export function suggestedRepoName(id: string): string {
  return `${REPO_PREFIX}${id}`
}

/**
 * Recovers a plugin id from a repository name, so a repo that follows the naming
 * convention can be listed even before its manifest is fetched.
 */
export function idFromRepoName(repoName: string): string | null {
  const lower = repoName.toLowerCase()
  const stripped = lower.startsWith(REPO_PREFIX) ? lower.slice(REPO_PREFIX.length) : lower
  return validatePluginId(stripped).length === 0 ? stripped : null
}
