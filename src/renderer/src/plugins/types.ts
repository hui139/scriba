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
  /** Total length of the document, in characters. */
  getLength: () => number
  /** Number of lines in the document. */
  getLineCount: () => number
  /** Read one line by its 1-based number; empty string when out of range. */
  getLine: (line: number) => string
  /** Document offset of the start of a 1-based line; 0 when out of range. */
  getLineStart: (line: number) => number
  /** Move the cursor to a 1-based line and column without selecting. */
  setCursor: (line: number, col?: number) => void
  /** Select a character range and scroll it into view. */
  selectRange: (from: number, to: number) => void
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

/** Read-only view of the open document, for plugins that need file context. */
export interface AppDocumentInfo {
  /** Absolute path, or null for a document that has never been saved. */
  path: string | null
  /** File name including the extension. */
  name: string
  /** True when the buffer differs from the saved file. */
  dirty: boolean
}

/**
 * Actions on the surrounding application, deliberately limited to what a plugin can do
 * without surprising the user: no file writing, no window resizing, no settings mutation
 * beyond the sidebar and theme.
 */
export interface AppApi {
  /** Currently open document, or null when the welcome screen is showing. */
  getDocument: () => AppDocumentInfo | null
  /** Absolute path of the open workspace folder, or null. */
  getWorkspaceRoot: () => string | null
  /** Id of the active theme, e.g. `violet-night`. */
  getTheme: () => string
  /** Switch to a theme that is already installed (built-in, user or plugin). */
  setTheme: (id: string) => boolean
  /** Which sidebar view is showing. */
  getSidebarView: () => SidebarViewApi
  /** Show a sidebar view, or hide the whole sidebar with `null`. */
  setSidebarView: (view: SidebarViewApi | null) => void
  /** Show or hide the interface sidebar. */
  setSidebarVisible: (visible: boolean) => void
}

export type SidebarViewApi = 'files' | 'search' | 'outline' | 'plugins'

export interface PluginAPI {
  manifest: PluginManifestInfo
  editor: EditorApi
  app: AppApi
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
    /** Remove one of this plugin's commands and any shortcut bound to it. */
    unregister: (id: string) => void
  }
  ui: {
    addStatusBarItem: (item: Omit<StatusBarItem, 'pluginId'>) => void
    /** Remove a status bar item this plugin added. */
    removeStatusBarItem: (id: string) => void
    addSidebarPanel: (panel: Omit<SidebarPanel, 'pluginId'>) => void
    /** Remove a sidebar panel this plugin added. */
    removeSidebarPanel: (id: string) => void
    showToast: (message: string, type?: 'info' | 'error' | 'success') => void
  }
  markdown: {
    registerCodeBlockRenderer: (language: string, renderer: CodeBlockRenderer) => void
    getCodeBlockRenderer: (language: string) => CodeBlockRenderer | undefined
  }
  themes: {
    register: (theme: ThemeContribution) => void
    /** Remove a theme this plugin registered. */
    unregister: (id: string) => void
  }
  events: {
    on: (event: PluginEvent, cb: (payload?: unknown) => void) => () => void
  }
  storage: {
    get: <T = unknown>(key: string) => T | undefined
    set: (key: string, value: unknown) => void
    delete: (key: string) => void
    /** All keys this plugin has stored, so it can clean up on uninstall. */
    keys: () => string[]
  }
  libs: {
    katex: typeof import('katex').default
    mermaid: () => Promise<typeof import('mermaid').default>
  }
  log: (...args: unknown[]) => void
}
