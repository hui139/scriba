import type {
  LanguageDefinition,
  LanguageInfo,
  TranslationVars
} from '../i18n/types'

export interface EditorApi {
  getText: () => string
  setText: (text: string) => void
  getSelection: () => string
  replaceSelection: (text: string) => void
  insertText: (text: string) => void
  wrapSelection: (before: string, after?: string) => void
  getCursor: () => { line: number; col: number }
  scrollToLine: (line: number) => void
  focus: () => void
  /** Replace the text between two character offsets, keeping the selection mapped. */
  replaceRange: (from: number, to: number, text: string) => void
}

export interface Command {
  id: string
  name: string
  /** Optional i18n key. When present it is preferred over `name` in the palette. */
  nameKey?: string
  hint?: string
  pluginId?: string
  run: () => void | Promise<void>
}

export interface StatusBarItem {
  id: string
  element: HTMLElement
  pluginId: string
  order?: number
}

export interface SidebarPanel {
  id: string
  title: string
  render: () => HTMLElement
  pluginId: string
}

export interface ThemeContribution {
  id: string
  name: string
  css: string
  pluginId?: string
}

export type CodeBlockRenderer = (code: string, el: HTMLElement) => void | Promise<void>

export type PluginEvent =
  | 'file:open'
  | 'file:save'
  | 'doc:change'
  | 'editor:ready'
  | 'workspace:change'

export interface PluginManifestInfo {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  minAppVersion?: string
  homepage?: string
  keywords?: string[]
}

/** A shortcut contributed by a plugin, shown in Settings → Shortcuts. */
export interface PluginKeybinding {
  /** Command id to run when the combo is pressed. */
  command: string
  /** Normalized combo, e.g. `mod+alt+k`. See `shortcuts.ts` for the format. */
  combo: string
}

export interface I18nApi {
  /** Translate a key using the current language. Supports `{name}` placeholders. */
  t: (key: string, vars?: TranslationVars) => string
  getLanguage: () => string
  setLanguage: (id: string) => void
  getLanguages: () => LanguageInfo[]
  /** Add a new interface language contributed by a plugin. */
  registerLanguage: (language: Omit<LanguageDefinition, 'pluginId'>) => void
  /** Merge extra messages into an existing language (e.g. plugin UI strings). */
  registerTranslations: (languageId: string, translations: Record<string, string>) => void
  /** Fires after the app language changes. Returns an unsubscribe function. */
  onChange: (cb: (language: string) => void) => () => void
}

export interface PluginAPI {
  manifest: PluginManifestInfo
  editor: EditorApi
  i18n: I18nApi
  commands: {
    register: (command: Omit<Command, 'pluginId'>) => void
    execute: (id: string) => Promise<void>
    /** All command ids currently registered, for menus and diagnostics. */
    list: () => string[]
    /**
     * Bind a key combination to one of this plugin's commands. The binding appears
     * in Settings → Shortcuts and can be changed by the user like any other.
     */
    registerKeybinding: (binding: PluginKeybinding) => void
  }
  ui: {
    addStatusBarItem: (item: Omit<StatusBarItem, 'pluginId'>) => void
    addSidebarPanel: (panel: Omit<SidebarPanel, 'pluginId'>) => void
    showToast: (message: string, type?: 'info' | 'error' | 'success') => void
  }
  markdown: {
    registerCodeBlockRenderer: (language: string, renderer: CodeBlockRenderer) => void
    getCodeBlockRenderer: (language: string) => CodeBlockRenderer | undefined
  }
  themes: {
    register: (theme: ThemeContribution) => void
  }
  events: {
    on: (event: PluginEvent, cb: (payload?: unknown) => void) => () => void
  }
  storage: {
    get: <T = unknown>(key: string) => T | undefined
    set: (key: string, value: unknown) => void
    delete: (key: string) => void
  }
  libs: {
    katex: typeof import('katex').default
    mermaid: () => Promise<typeof import('mermaid').default>
  }
  log: (...args: unknown[]) => void
}
