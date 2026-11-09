import { app, dialog, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { IPC } from '../../shared/ipc'
import { isCompatible } from '../../shared/version'
import type {
  GithubPluginResult,
  InstalledPlugin,
  MarketplaceEntry,
  PluginManifest,
  PluginSource
} from '../../shared/types'
import { mt } from '../i18n'
import { fetchIndex, installFromMarketplace, MarketplaceError } from '../export/marketplace'
import { GithubError, installFromGithub, searchGithubPlugins } from '../export/githubPlugins'
import { validateManifest } from '../../shared/pluginSpec'

/** GitHub tokens are stored next to the other plugin state, never logged. */
function githubTokenFile(): string {
  return join(app.getPath('userData'), 'github-token.json')
}

async function readGithubToken(): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(githubTokenFile(), 'utf8')
    const parsed = JSON.parse(raw) as { token?: unknown }
    return typeof parsed.token === 'string' && parsed.token.trim() ? parsed.token.trim() : undefined
  } catch {
    return undefined
  }
}

async function writeGithubToken(token: string): Promise<void> {
  const file = githubTokenFile()
  if (!token.trim()) {
    await fs.rm(file, { force: true })
    return
  }
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ token: token.trim() }, null, 2), 'utf8')
}

/**
 * Default marketplace index.
 *
 * Empty on purpose: the project ships no hosted plugin index, and the Browse tab works
 * through the GitHub `scriba-plugin` topic instead. A deployment that wants a curated
 * index (an intranet, a reviewed mirror) sets this to its own JSON URL, and users can
 * always override it in Settings.
 */
const DEFAULT_MARKETPLACE_URL = ''

interface PluginState {
  disabled: string[]
}

function userPluginsDir(): string {
  return join(app.getPath('userData'), 'plugins')
}

function builtinPluginsDir(): string {
  const candidates = [
    join(app.getAppPath(), 'plugins'),
    join(process.resourcesPath, 'plugins')
  ]
  return candidates.find((p) => existsSync(p)) ?? candidates[0]
}

function exportTemplatesDir(): string {
  return join(app.getPath('userData'), 'export-templates')
}

function themesDir(): string {
  return join(app.getPath('userData'), 'themes')
}

function stateFile(): string {
  return join(app.getPath('userData'), 'plugins-state.json')
}

async function readState(): Promise<PluginState> {
  try {
    const raw = await fs.readFile(stateFile(), 'utf8')
    const parsed = JSON.parse(raw) as PluginState
    return { disabled: Array.isArray(parsed.disabled) ? parsed.disabled : [] }
  } catch {
    return { disabled: [] }
  }
}

async function writeState(state: PluginState): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(stateFile(), JSON.stringify(state, null, 2), 'utf8')
}

async function readManifest(dir: string): Promise<PluginManifest | null> {
  try {
    const raw = await fs.readFile(join(dir, 'manifest.json'), 'utf8')
    const manifest = JSON.parse(raw) as PluginManifest
    if (!manifest.id || !manifest.name || !manifest.version) return null
    return manifest
  } catch {
    return null
  }
}

async function scanDir(dir: string, builtin: boolean, disabled: string[]): Promise<InstalledPlugin[]> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const result: InstalledPlugin[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const pluginDir = join(dir, entry.name)
    const manifest = await readManifest(pluginDir)
    if (!manifest) continue
    result.push({
      manifest,
      dir: pluginDir,
      builtin,
      enabled: !disabled.includes(manifest.id),
      // A plugin built for a newer app may call APIs that do not exist here, so the
      // UI warns instead of letting it fail at activation time.
      compatible: isCompatible(manifest, app.getVersion())
    })
  }
  return result
}

async function listPlugins(): Promise<InstalledPlugin[]> {
  const state = await readState()
  const builtin = await scanDir(builtinPluginsDir(), true, state.disabled)
  const user = await scanDir(userPluginsDir(), false, state.disabled)
  const seen = new Set(builtin.map((p) => p.manifest.id))
  return [...builtin, ...user.filter((p) => !seen.has(p.manifest.id))]
}

async function loadPlugin(id: string): Promise<PluginSource | null> {
  const plugins = await listPlugins()
  const plugin = plugins.find((p) => p.manifest.id === id)
  if (!plugin || !plugin.enabled) return null
  const mainFile = plugin.manifest.main ?? 'index.js'
  const mainPath = join(plugin.dir, mainFile)
  let source = ''
  try {
    source = await fs.readFile(mainPath, 'utf8')
  } catch {
    return null
  }
  let style: string | undefined
  const stylePath = join(plugin.dir, 'style.css')
  if (existsSync(stylePath)) {
    try {
      style = await fs.readFile(stylePath, 'utf8')
    } catch {
      style = undefined
    }
  }
  return { manifest: plugin.manifest, dir: plugin.dir, source, style }
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(userPluginsDir(), { recursive: true })
  await fs.mkdir(themesDir(), { recursive: true })
  await fs.mkdir(exportTemplatesDir(), { recursive: true })
}

export function registerPluginIpc(): void {
  ipcMain.handle(IPC.pluginsList, async () => {
    await ensureDirs()
    return listPlugins()
  })

  ipcMain.handle(IPC.pluginsLoad, async (_e, id: string) => {
    return loadPlugin(id)
  })

  ipcMain.handle(IPC.pluginsToggle, async (_e, id: string, enabled: boolean) => {
    const state = await readState()
    const set = new Set(state.disabled)
    if (enabled) set.delete(id)
    else set.add(id)
    await writeState({ disabled: [...set] })
    return true
  })

  ipcMain.handle(IPC.pluginsInstallFolder, async () => {
    await ensureDirs()
    const result = await dialog.showOpenDialog({
      title: mt('dialog.selectPluginFolder'),
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const src = result.filePaths[0]
    const manifest = await readManifest(src)
    if (!manifest) throw new Error(mt('error.invalidManifest'))
    const target = join(userPluginsDir(), manifest.id)
    if (existsSync(target)) {
      throw new Error(mt('error.pluginInstalled', { id: manifest.id }))
    }
    await fs.cp(src, target, { recursive: true })
    return manifest.id
  })

  ipcMain.handle(IPC.pluginsUninstall, async (_e, id: string) => {
    const plugins = await listPlugins()
    const plugin = plugins.find((p) => p.manifest.id === id)
    if (!plugin) return false
    if (plugin.builtin) throw new Error(mt('error.builtinUninstall'))
    await fs.rm(plugin.dir, { recursive: true, force: true })
    return true
  })

  ipcMain.handle(IPC.pluginsOpenDir, async () => {
    await ensureDirs()
    await shell.openPath(userPluginsDir())
    return userPluginsDir()
  })

  ipcMain.handle(IPC.themesOpenDir, async () => {
    await ensureDirs()
    await shell.openPath(themesDir())
    return themesDir()
  })

  ipcMain.handle(IPC.themesList, async () => {
    await ensureDirs()
    let entries: string[] = []
    try {
      entries = (await fs.readdir(themesDir())).filter((f) => f.endsWith('.css'))
    } catch {
      entries = []
    }
    return Promise.all(
      entries.map(async (file) => {
        const css = await fs.readFile(join(themesDir(), file), 'utf8')
        return { id: `user:${basename(file, '.css')}`, name: basename(file, '.css'), css }
      })
    )
  })

  ipcMain.handle(IPC.exportTemplatesOpenDir, async () => {
    await ensureDirs()
    await shell.openPath(exportTemplatesDir())
    return exportTemplatesDir()
  })

  /**
   * Export stylesheets are plain `.css` files the user drops into
   * `<userData>/export-templates/`. They are applied on top of the built-in export
   * CSS, mirroring the usual "export theme" folder convention.
   */
  ipcMain.handle(IPC.exportTemplatesList, async () => {
    await ensureDirs()
    let entries: string[] = []
    try {
      entries = (await fs.readdir(exportTemplatesDir())).filter((f) => f.endsWith('.css'))
    } catch {
      entries = []
    }
    const templates = await Promise.all(
      entries.map(async (file) => {
        try {
          const css = await fs.readFile(join(exportTemplatesDir(), file), 'utf8')
          return { id: basename(file, '.css'), name: basename(file, '.css'), css }
        } catch {
          return null
        }
      })
    )
    return templates.filter((item): item is { id: string; name: string; css: string } => item !== null)
  })

  ipcMain.handle(IPC.pluginsReload, async () => {
    return listPlugins()
  })

  /**
   * Searches GitHub for repositories tagged `scriba-plugin`.
   *
   * The token is optional: without one GitHub allows 10 searches per minute, which
   * is enough for browsing but easy to hit while typing. It is stored locally and
   * never sent anywhere except GitHub.
   */
  ipcMain.handle(IPC.githubSearch, async (_e, query: string, perPage?: number) => {
    try {
      return await searchGithubPlugins(query ?? '', {
        token: await readGithubToken(),
        perPage
      })
    } catch (error) {
      if (error instanceof GithubError) {
        throw new Error(error.message)
      }
      throw error
    }
  })

  ipcMain.handle(IPC.githubInstall, async (_e, result: GithubPluginResult) => {
    if (!result || typeof result.owner !== 'string' || typeof result.repo !== 'string') {
      throw new Error(mt('error.marketplaceInvalidEntry'))
    }
    try {
      const installed = await installFromGithub(
        result,
        userPluginsDir(),
        app.getVersion(),
        await readGithubToken()
      )
      // A freshly installed plugin must not inherit an old "disabled" flag.
      const state = await readState()
      if (state.disabled.includes(installed.id)) {
        await writeState({ disabled: state.disabled.filter((id) => id !== installed.id) })
      }
      return installed
    } catch (error) {
      if (error instanceof GithubError) throw new Error(error.message)
      throw error
    }
  })

  ipcMain.handle(IPC.githubToken, async () => readGithubToken())

  ipcMain.handle(IPC.setGithubToken, async (_e, token: string) => {
    await writeGithubToken(token ?? '')
    return true
  })

  ipcMain.handle(IPC.validateManifest, async (_e, manifest: unknown) => {
    return validateManifest(manifest)
  })

  /**
   * Fetches a JSON marketplace index. Kept as an alternative to GitHub search so a
   * private or curated registry can still be used.
   */
  ipcMain.handle(IPC.marketplaceIndex, async (_e, url?: string) => {
    const target = (url && url.trim()) || DEFAULT_MARKETPLACE_URL
    if (!target) {
      // Nothing is configured and the project ships no index. Saying so is clearer than
      // letting an empty URL fail inside fetch with a network error.
      throw new Error(mt('error.marketplaceNoIndex'))
    }
    return fetchIndex(target)
  })

  ipcMain.handle(IPC.marketplaceInstall, async (_e, entry: MarketplaceEntry) => {
    if (!entry || typeof entry.id !== 'string' || typeof entry.download !== 'string') {
      throw new Error(mt('error.marketplaceInvalidEntry'))
    }
    try {
      const result = await installFromMarketplace(entry, userPluginsDir(), app.getVersion())
      // A freshly installed plugin must not inherit an old "disabled" flag.
      const state = await readState()
      if (state.disabled.includes(result.id)) {
        await writeState({ disabled: state.disabled.filter((id) => id !== result.id) })
      }
      return result
    } catch (error) {
      if (error instanceof MarketplaceError) throw new Error(error.message)
      throw error
    }
  })
}
