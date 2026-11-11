import { create } from 'zustand'
import katex from 'katex'
import type { InstalledPlugin, PluginSource } from '@shared/types'
import { getCurrentView } from '../editor/viewRef'
import { goToLine } from '../editor/navigate'
import { useUI } from '../store/ui'
import { useSettings } from '../store/settings'
import { useWorkspace } from '../store/workspace'
import { builtinThemes } from '../themes'
import {
  clearPluginContributions,
  codeRendererMap,
  commandMap,
  executeCommand,
  panelMap,
  publishRegistry,
  registerCodeRenderer,
  registerCommand,
  registerPluginKeybinding,
  removeCommandOfPlugin,
  removePanelOfPlugin,
  removePluginContributions,
  removeStatusItemOfPlugin,
  removeThemeOfPlugin,
  statusItemMap,
  themeMap,
  useRegistry
} from './registry'
import { useI18n, t } from '../i18n'
import type { EditorApi, PluginAPI, PluginEvent, ThemeContribution } from './types'

interface PluginListState {
  plugins: InstalledPlugin[]
  loading: boolean
  setPlugins: (plugins: InstalledPlugin[]) => void
  setLoading: (loading: boolean) => void
}

export const usePluginList = create<PluginListState>((set) => ({
  plugins: [],
  loading: false,
  setPlugins: (plugins) => set({ plugins }),
  setLoading: (loading) => set({ loading })
}))

type Listener = (payload?: unknown) => void
const listeners = new Map<PluginEvent, Set<Listener>>()
const activePlugins = new Map<
  string,
  { deactivate?: () => void; disposers: Array<() => void> }
>()

export function emitPluginEvent(event: PluginEvent, payload?: unknown): void {
  listeners.get(event)?.forEach((cb) => {
    try {
      cb(payload)
    } catch (error) {
      console.error('[scriba] plugin event listener failed', error)
    }
  })
}

function createEditorApi(): EditorApi {
  const view = () => getCurrentView()
  return {
    getText: () => view()?.state.doc.toString() ?? '',
    setText: (text) => {
      const v = view()
      if (!v) return
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } })
    },
    getSelection: () => {
      const v = view()
      if (!v) return ''
      const { from, to } = v.state.selection.main
      return v.state.sliceDoc(from, to)
    },
    replaceSelection: (text) => {
      const v = view()
      if (!v) return
      const { from, to } = v.state.selection.main
      v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
      v.focus()
    },
    insertText: (text) => {
      const v = view()
      if (!v) return
      const { from, to } = v.state.selection.main
      v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
      v.focus()
    },
    wrapSelection: (before, after = before) => {
      const v = view()
      if (!v) return
      const { from, to } = v.state.selection.main
      const selected = v.state.sliceDoc(from, to)
      v.dispatch({
        changes: { from, to, insert: `${before}${selected}${after}` },
        selection: { anchor: from + before.length, head: from + before.length + selected.length }
      })
      v.focus()
    },
    getCursor: () => {
      const v = view()
      if (!v) return { line: 1, col: 1 }
      const head = v.state.selection.main.head
      const line = v.state.doc.lineAt(head)
      return { line: line.number, col: head - line.from + 1 }
    },
    scrollToLine: (lineNumber) => {
      const v = view()
      if (!v) return
      goToLine(v, lineNumber)
    },
    focus: () => view()?.focus(),
    replaceRange: (from, to, text) => {
      const v = view()
      if (!v) return
      const length = v.state.doc.length
      const start = Math.max(0, Math.min(from, length))
      const end = Math.max(start, Math.min(to, length))
      v.dispatch({ changes: { from: start, to: end, insert: text } })
    },
    getLength: () => view()?.state.doc.length ?? 0,
    getLineCount: () => view()?.state.doc.lines ?? 0,
    getLine: (lineNumber) => {
      const v = view()
      if (!v) return ''
      // CodeMirror lines are 1-based; clamp instead of throwing so a plugin does not
      // crash the host when it guesses a line number.
      const total = v.state.doc.lines
      if (!Number.isFinite(lineNumber) || lineNumber < 1 || lineNumber > total) return ''
      return v.state.doc.line(Math.floor(lineNumber)).text
    },
    getLineStart: (lineNumber) => {
      const v = view()
      if (!v) return 0
      const total = v.state.doc.lines
      if (!Number.isFinite(lineNumber) || lineNumber < 1 || lineNumber > total) return 0
      return v.state.doc.line(Math.floor(lineNumber)).from
    },
    setCursor: (lineNumber, col = 1) => {
      const v = view()
      if (!v) return
      const total = v.state.doc.lines
      if (!Number.isFinite(lineNumber) || lineNumber < 1) return
      const line = v.state.doc.line(Math.min(Math.floor(lineNumber), total))
      const offset = Math.max(0, Math.min((col || 1) - 1, line.length))
      const pos = line.from + offset
      v.dispatch({ selection: { anchor: pos }, scrollIntoView: true })
      v.focus()
    },
    selectRange: (from, to) => {
      const v = view()
      if (!v) return
      const length = v.state.doc.length
      const start = Math.max(0, Math.min(from, length))
      const end = Math.max(start, Math.min(to, length))
      v.dispatch({ selection: { anchor: start, head: end }, scrollIntoView: true })
      v.focus()
    }
  }
}

function createApi(source: PluginSource, disposers: Array<() => void>): PluginAPI {
  const pluginId = source.manifest.id
  const storagePrefix = `scriba-plugin:${pluginId}:`

  return {
    manifest: {
      id: source.manifest.id,
      name: source.manifest.name,
      version: source.manifest.version,
      description: source.manifest.description,
      author: source.manifest.author,
      minAppVersion: source.manifest.minAppVersion,
      homepage: source.manifest.homepage,
      keywords: source.manifest.keywords
    },
    editor: createEditorApi(),
    app: {
      getDocument: () => {
        const state = useWorkspace.getState()
        const doc = state.docs.find((item) => item.id === state.activeId)
        if (!doc) return null
        return {
          path: doc.path,
          name: doc.name,
          dirty: doc.content !== doc.savedContent
        }
      },
      getWorkspaceRoot: () => useWorkspace.getState().rootPath,
      getTheme: () => useSettings.getState().theme,
      setTheme: (id) => {
        // Only switch to a theme that exists, so a typo cannot blank out the interface.
        const known = [
          ...builtinThemes.map((theme) => theme.id),
          ...useRegistry.getState().themes.map((theme) => theme.id)
        ]
        if (!known.includes(id)) {
          console.warn(`[scriba] plugin "${pluginId}" tried to switch to unknown theme "${id}"`)
          return false
        }
        useSettings.getState().setTheme(id)
        return true
      },
      getSidebarView: () => useSettings.getState().sidebarView,
      setSidebarView: (view) => {
        if (view === null) {
          useSettings.getState().setSidebarVisible(false)
          return
        }
        useSettings.getState().setSidebarView(view)
      },
      setSidebarVisible: (visible) => useSettings.getState().setSidebarVisible(visible)
    },
    i18n: {
      t: (key, vars) => t(key, vars),
      getLanguage: () => useI18n.getState().language,
      setLanguage: (id) => {
        useI18n.getState().setLanguage(id)
      },
      getLanguages: () =>
        useI18n.getState().languages.map(({ id, name }) => ({ id, name })),
      registerLanguage: (language) => {
        const dispose = useI18n.getState().registerLanguage(pluginId, language)
        disposers.push(dispose)
      },
      registerTranslations: (languageId, translations) => {
        const dispose = useI18n
          .getState()
          .registerTranslations(pluginId, languageId, translations)
        disposers.push(dispose)
      },
      onChange: (cb) => {
        let previous = useI18n.getState().language
        const unsubscribe = useI18n.subscribe((state) => {
          if (state.language === previous) return
          previous = state.language
          try {
            cb(state.language)
          } catch (error) {
            console.error(`[scriba] i18n listener failed for "${pluginId}"`, error)
          }
        })
        disposers.push(unsubscribe)
        return unsubscribe
      }
    },
    commands: {
      register: (command) => {
        registerCommand({ ...command, pluginId })
      },
      execute: executeCommand,
      list: () => [...commandMap.keys()],
      registerKeybinding: (binding) => {
        // Reject bindings that point at a command this plugin did not register, so a
        // typo fails loudly instead of silently binding nothing.
        const command = commandMap.get(binding.command)
        if (!command) {
          console.warn(
            `[scriba] plugin "${pluginId}" bound "${binding.combo}" to unknown command "${binding.command}"`
          )
          return
        }
        if (command.pluginId !== pluginId) {
          console.warn(
            `[scriba] plugin "${pluginId}" cannot bind a shortcut for command "${binding.command}" owned by another plugin`
          )
          return
        }
        registerPluginKeybinding(binding.command, binding.combo, pluginId)
      },
      unregister: (id) => {
        if (!removeCommandOfPlugin(id, pluginId)) {
          console.warn(
            `[scriba] plugin "${pluginId}" cannot unregister command "${id}": not found or owned by another plugin`
          )
        }
      }
    },
    ui: {
      addStatusBarItem: (item) => {
        statusItemMap.set(item.id, { ...item, pluginId })
        publishRegistry()
      },
      removeStatusBarItem: (id) => {
        removeStatusItemOfPlugin(id, pluginId)
      },
      addSidebarPanel: (panel) => {
        panelMap.set(panel.id, { ...panel, pluginId })
        publishRegistry()
      },
      removeSidebarPanel: (id) => {
        removePanelOfPlugin(id, pluginId)
      },
      showToast: (message, type = 'info') => {
        useUI.getState().toast(`[${source.manifest.name}] ${message}`, type)
      }
    },
    markdown: {
      registerCodeBlockRenderer: (language, renderer) => {
        registerCodeRenderer(language, renderer, pluginId)
      },
      getCodeBlockRenderer: (language) => codeRendererMap.get(language.toLowerCase())
    },
    themes: {
      register: (theme: ThemeContribution) => {
        themeMap.set(theme.id, { ...theme, pluginId })
        publishRegistry()
      },
      unregister: (id) => {
        removeThemeOfPlugin(id, pluginId)
      }
    },
    events: {
      on: (event, cb) => {
        if (!listeners.has(event)) listeners.set(event, new Set())
        listeners.get(event)!.add(cb)
        const dispose = (): void => {
          listeners.get(event)?.delete(cb)
        }
        disposers.push(dispose)
        return dispose
      }
    },
    storage: {
      get: <T>(key: string): T | undefined => {
        try {
          const raw = localStorage.getItem(storagePrefix + key)
          return raw === null ? undefined : (JSON.parse(raw) as T)
        } catch {
          return undefined
        }
      },
      set: (key, value) => {
        localStorage.setItem(storagePrefix + key, JSON.stringify(value))
      },
      delete: (key) => {
        localStorage.removeItem(storagePrefix + key)
      },
      keys: () => {
        const result: string[] = []
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i)
          if (key && key.startsWith(storagePrefix)) result.push(key.slice(storagePrefix.length))
        }
        return result
      }
    },
    libs: {
      katex,
      mermaid: async () => {
        const mod = await import('mermaid')
        return mod.default
      }
    },
    log: (...args) => console.log(`[plugin:${pluginId}]`, ...args)
  }
}

export async function loadAllPlugins(): Promise<void> {
  for (const [, entry] of activePlugins) {
    try {
      entry.deactivate?.()
    } catch (error) {
      console.error('[scriba] plugin deactivate failed', error)
    }
    for (const dispose of entry.disposers) {
      try {
        dispose()
      } catch (error) {
        console.error('[scriba] plugin cleanup failed', error)
      }
    }
  }
  activePlugins.clear()
  clearPluginContributions()
  for (const tag of styleTags.values()) tag.remove()
  styleTags.clear()

  const list = await window.api.plugins.list()
  usePluginList.getState().setPlugins(list)

  for (const plugin of list) {
    if (!plugin.enabled) continue
    await activatePlugin(plugin.manifest.id)
  }
  publishRegistry()
}

async function activatePlugin(id: string): Promise<void> {
  const source = await window.api.plugins.load(id)
  if (!source) return

  const disposers: Array<() => void> = []
  const api = createApi(source, disposers)

  try {
    const mod = await evaluatePluginModule(id, source.source, api)
    if (typeof mod.activate !== 'function') {
      throw new Error(t('plugins.needActivate'))
    }
    await mod.activate(api)
    activePlugins.set(id, { deactivate: mod.deactivate, disposers })
    if (source.style) injectPluginStyle(id, source.style)
  } catch (error) {
    console.error(`[scriba] failed to activate plugin "${id}"`, error)
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        // ignore cleanup errors while a plugin fails to activate
      }
    }
    removePluginContributions(id)
    useUI.getState().toast(
      t('plugins.failed', {
        name: source.manifest.name,
        message: error instanceof Error ? error.message : String(error)
      }),
      'error'
    )
  }
}

type PluginModule = {
  activate?: (api: PluginAPI) => void | Promise<void>
  deactivate?: () => void
}

/**
 * Executes a plugin entry file without `eval`/`new Function`, so the renderer can
 * run under a CSP without `'unsafe-eval'`.
 *
 * The source is CommonJS-style (`module.exports.activate = ...`), so it is wrapped
 * in a tiny CommonJS shim and loaded as a real ES module through a Blob URL.
 * A Blob module is covered by `script-src blob:` rather than by eval permissions.
 */
async function evaluatePluginModule(
  id: string,
  code: string,
  api: PluginAPI
): Promise<PluginModule> {
  const apiKey = `__scribaPluginApi_${id}`
  const shim = [
    'const module = { exports: {} };',
    'const exports = module.exports;',
    '(function (module, exports, scriba) {',
    `"use strict";`,
    code,
    `})(module, module.exports, globalThis[${JSON.stringify(apiKey)}]);`,
    'export const activate = module.exports.activate;',
    'export const deactivate = module.exports.deactivate;'
  ].join('\n')

  const globals = globalThis as Record<string, unknown>
  globals[apiKey] = api

  const blobUrl = URL.createObjectURL(new Blob([shim], { type: 'text/javascript' }))
  try {
    return (await import(/* @vite-ignore */ `${blobUrl}#${id}`)) as PluginModule
  } finally {
    URL.revokeObjectURL(blobUrl)
    delete globals[apiKey]
  }
}

const styleTags = new Map<string, HTMLStyleElement>()

function injectPluginStyle(id: string, css: string): void {
  const existing = styleTags.get(id)
  if (existing) existing.remove()
  const style = document.createElement('style')
  style.dataset.plugin = id
  style.textContent = css
  document.head.appendChild(style)
  styleTags.set(id, style)
}

export async function togglePlugin(id: string, enabled: boolean): Promise<void> {
  await window.api.plugins.toggle(id, enabled)
  await loadAllPlugins()
}

export async function reloadPlugins(): Promise<void> {
  await loadAllPlugins()
  useUI.getState().toast(t('plugins.reloaded'))
}

export async function installPluginFromFolder(): Promise<void> {
  const id = await window.api.plugins.installFolder()
  if (!id) return
  await loadAllPlugins()
  useUI.getState().toast(t('plugins.installed', { id }), 'success')
}

export async function uninstallPlugin(id: string): Promise<void> {
  await window.api.plugins.uninstall(id)
  await loadAllPlugins()
  useUI.getState().toast(t('plugins.removed', { id }))
}
