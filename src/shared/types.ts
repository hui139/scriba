export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface FilePayload {
  path: string
  content: string
  mtimeMs: number
}

/**
 * Per-language overrides for the display fields of a manifest.
 *
 * `manifest.name` and `manifest.description` are required to stay single strings so
 * older versions and other tools can read a manifest without knowing about this field.
 * Plugins that ship translations add them here and the UI prefers them when the active
 * interface language matches.
 */
export interface PluginManifestI18n {
  name?: string
  description?: string
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  main?: string
  minAppVersion?: string
  keywords?: string[]
  /** Repository or documentation URL, shown in the plugin manager. */
  homepage?: string
  /** SPDX license identifier, e.g. `MIT`. */
  license?: string
  /**
   * Localised display names, keyed by BCP-47 language tag (`ja-JP`, `zh-CN`, …).
   * Falls back to `name` / `description` when the active language has no entry.
   */
  i18n?: Record<string, PluginManifestI18n>
}

export interface InstalledPlugin {
  manifest: PluginManifest
  dir: string
  enabled: boolean
  builtin: boolean
  /** False when the plugin requires a newer app version than the running one. */
  compatible?: boolean
  /** Set when loading or activating the plugin failed, for display in the UI. */
  error?: string
}

/**
 * One entry in the plugin marketplace index.
 *
 * The index is a JSON file fetched from a repository; each entry points at a
 * downloadable archive plus the metadata needed to display and install it.
 */
export interface MarketplaceEntry {
  /** Must match the `id` inside the plugin's manifest. */
  id: string
  name: string
  version: string
  description?: string
  author?: string
  license?: string
  homepage?: string
  keywords?: string[]
  /** Minimum Scriba version the plugin needs. */
  minAppVersion?: string
  /**
   * Download URL for a `.zip` containing the plugin folder (manifest.json at the
   * archive root or inside a single top-level directory).
   */
  download: string
  /** Optional repository URL, shown as "source". */
  repository?: string
}

/** The marketplace index document. */
export interface MarketplaceIndex {
  /** Format version, so an old client can reject a newer index. */
  version: number
  /** Where this index came from, for display and debugging. */
  source?: string
  plugins: MarketplaceEntry[]
}

/** Result of installing a plugin from the marketplace. */
export interface MarketplaceInstallResult {
  id: string
  version: string
  /** Directory the plugin was installed into. */
  dir: string
}

/**
 * A plugin discovered on GitHub.
 *
 * Search results come from repositories carrying the `scriba-plugin` topic. The
 * manifest fields are filled in once the repository's manifest has been fetched,
 * so a result can be shown before installation.
 */
export interface GithubPluginResult {
  /** `owner/name` of the repository. */
  fullName: string
  owner: string
  repo: string
  description?: string
  stars: number
  updatedAt: string
  topics: string[]
  htmlUrl: string
  defaultBranch: string
  /** True when the repository name follows the `scriba-plugin-*` convention. */
  followsNaming: boolean
  /** Id parsed from the repository name, if it follows the convention. */
  idHint?: string
  /** Manifest fetched from the repository, when it could be read. */
  manifest?: PluginManifest
  /** Set when the manifest could not be read or failed validation. */
  problem?: string
}

/** A page of GitHub search results. */
export interface GithubSearchResult {
  items: GithubPluginResult[]
  /** Total matches reported by GitHub, which may exceed the returned page. */
  totalCount: number
  /** True when GitHub's rate limit stopped further requests. */
  rateLimited?: boolean
}

export interface PluginSource {
  manifest: PluginManifest
  dir: string
  source: string
  style?: string
}

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  userDataDir: string
  pluginsDir: string
  themesDir: string
}

export type FsChangeEvent = {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
}

export interface ExportOptions {
  html: string
  defaultName?: string
}

/** One matching line inside a file, for the workspace-wide search panel. */
export interface SearchMatch {
  line: number
  /** The full line text, trimmed for display. */
  text: string
  /** Character offset of the match within `text`, for highlighting. */
  start: number
  length: number
}

export interface SearchFileResult {
  path: string
  /** File name without its directory, used as the result heading. */
  name: string
  /** Path relative to the workspace root, shown under the file name. */
  relative: string
  matches: SearchMatch[]
}

export interface SearchOptions {
  query: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
  /** Maximum number of files returned; the UI shows a hint when hit. */
  limit?: number
}
