import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  AppInfo,
  FileNode,
  FilePayload,
  FsChangeEvent,
  InstalledPlugin,
  GithubPluginResult,
  GithubSearchResult,
  MarketplaceEntry,
  MarketplaceIndex,
  MarketplaceInstallResult,
  PluginSource,
  SearchFileResult,
  SearchOptions
} from '../shared/types'

const api = {
  app: {
    info: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
    setLanguage: (language: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.appSetLanguage, language)
  },
  dialog: {
    openFolder: (): Promise<{ path: string; tree: FileNode[] } | null> =>
      ipcRenderer.invoke(IPC.openFolder),
    openFiles: (): Promise<FilePayload[]> => ipcRenderer.invoke(IPC.openFiles),
    saveAs: (defaultPath?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.saveAs, defaultPath)
  },
  fs: {
    readDir: (dir: string): Promise<FileNode[]> => ipcRenderer.invoke(IPC.readDir, dir),
    readFile: (path: string): Promise<FilePayload> => ipcRenderer.invoke(IPC.readFile, path),
    writeFile: (path: string, content: string): Promise<{ path: string; mtimeMs: number }> =>
      ipcRenderer.invoke(IPC.writeFile, path, content),
    savePastedImage: (
      docPath: string | null,
      data: Uint8Array,
      extension: string
    ): Promise<{ path: string; markdownPath: string }> =>
      ipcRenderer.invoke(IPC.savePastedImage, docPath, data, extension),
    createEntry: (parentDir: string, name: string, isDirectory: boolean): Promise<string> =>
      ipcRenderer.invoke(IPC.createEntry, parentDir, name, isDirectory),
    renameEntry: (
      oldPath: string,
      newName: string,
      updateLinks = true
    ): Promise<{ path: string; updatedReferences: number }> =>
      ipcRenderer.invoke(IPC.renameEntry, oldPath, newName, updateLinks),
    deleteEntry: (path: string): Promise<boolean> => ipcRenderer.invoke(IPC.deleteEntry, path),
    exists: (path: string): Promise<boolean> => ipcRenderer.invoke(IPC.pathExists, path),
    watchFolder: (dir: string): Promise<boolean> => ipcRenderer.invoke(IPC.watchFolder, dir),
    unwatchFolder: (dir: string): Promise<boolean> => ipcRenderer.invoke(IPC.unwatchFolder, dir),
    showItemInFolder: (path: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.showItemInFolder, path),
    readImageDataUri: (docPath: string | null, src: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.readImageDataUri, docPath, src),
    searchWorkspace: (root: string, options: SearchOptions): Promise<SearchFileResult[]> =>
      ipcRenderer.invoke(IPC.searchWorkspace, root, options)
  },
  plugins: {
    list: (): Promise<InstalledPlugin[]> => ipcRenderer.invoke(IPC.pluginsList),
    load: (id: string): Promise<PluginSource | null> => ipcRenderer.invoke(IPC.pluginsLoad, id),
    toggle: (id: string, enabled: boolean): Promise<boolean> =>
      ipcRenderer.invoke(IPC.pluginsToggle, id, enabled),
    installFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.pluginsInstallFolder),
    uninstall: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.pluginsUninstall, id),
    openDir: (): Promise<string> => ipcRenderer.invoke(IPC.pluginsOpenDir),
    reload: (): Promise<InstalledPlugin[]> => ipcRenderer.invoke(IPC.pluginsReload),
    marketplaceIndex: (url?: string): Promise<MarketplaceIndex> =>
      ipcRenderer.invoke(IPC.marketplaceIndex, url),
    marketplaceInstall: (entry: MarketplaceEntry): Promise<MarketplaceInstallResult> =>
      ipcRenderer.invoke(IPC.marketplaceInstall, entry),
    githubSearch: (query: string, perPage?: number): Promise<GithubSearchResult> =>
      ipcRenderer.invoke(IPC.githubSearch, query, perPage),
    githubInstall: (result: GithubPluginResult): Promise<MarketplaceInstallResult> =>
      ipcRenderer.invoke(IPC.githubInstall, result),
    getGithubToken: (): Promise<string | undefined> => ipcRenderer.invoke(IPC.githubToken),
    setGithubToken: (token: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.setGithubToken, token),
    validateManifest: (
      manifest: unknown
    ): Promise<Array<{ field: string; message: string }>> =>
      ipcRenderer.invoke(IPC.validateManifest, manifest)
  },
  themes: {
    list: (): Promise<Array<{ id: string; name: string; css: string }>> =>
      ipcRenderer.invoke(IPC.themesList),
    openDir: (): Promise<string> => ipcRenderer.invoke(IPC.themesOpenDir)
  },
  exportTemplates: {
    list: (): Promise<Array<{ id: string; name: string; css: string }>> =>
      ipcRenderer.invoke(IPC.exportTemplatesList),
    openDir: (): Promise<string> => ipcRenderer.invoke(IPC.exportTemplatesOpenDir)
  },
  files: {
    getPath: (file: unknown): string => {
      try {
        return (
          webUtils as unknown as { getPathForFile: (value: unknown) => string }
        ).getPathForFile(file)
      } catch {
        return ''
      }
    }
  },
  export: {
    html: (html: string, defaultName?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.exportHtml, html, defaultName),
    pdf: (html: string, defaultName?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.exportPdf, html, defaultName),
    word: (html: string, defaultName?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.exportWord, html, defaultName),
    text: (text: string, defaultName?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.exportText, text, defaultName),
    image: (html: string, defaultName?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.exportImage, html, defaultName),
    latex: (latex: string, defaultName?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.exportLatex, latex, defaultName),
    epub: (
      payload: { title: string; xhtml: string; css: string; docPath?: string | null },
      defaultName?: string
    ): Promise<string | null> => ipcRenderer.invoke(IPC.exportEpub, payload, defaultName),
    folder: (
      source: string,
      extensions?: string[]
    ): Promise<{
      destination: string
      filesCopied: number
      bytesCopied: number
      skippedDirs: string[]
      skippedLarge: number
      truncated: boolean
    } | null> => ipcRenderer.invoke(IPC.exportFolder, source, extensions),
    print: (html: string): Promise<boolean> => ipcRenderer.invoke(IPC.printDocument, html)
  },
  recent: {
    list: (): Promise<string[]> => ipcRenderer.invoke(IPC.recentFiles),
    add: (filePath: string): Promise<string[]> => ipcRenderer.invoke(IPC.addRecentFile, filePath),
    clear: (): Promise<string[]> => ipcRenderer.invoke(IPC.clearRecentFiles),
    refreshMenu: (): Promise<boolean> => ipcRenderer.invoke(IPC.refreshMenu)
  },
  window: {
    minimize: (): void => ipcRenderer.send(IPC.windowMinimize),
    maximize: (): void => ipcRenderer.send(IPC.windowMaximize),
    close: (): void => ipcRenderer.send(IPC.windowClose),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.windowIsMaximized),
    setSpellcheck: (on: boolean): Promise<boolean> => ipcRenderer.invoke(IPC.setSpellcheck, on),
    setTitleBarTheme: (colors: { background: string; symbol: string }): void =>
      ipcRenderer.send(IPC.setTitleBarTheme, colors),
    spellcheckLanguages: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC.spellcheckLanguages)
  },
  onOpenPath: (cb: (path: string) => void): (() => void) => {
    const listener = (_e: unknown, path: string): void => cb(path)
    ipcRenderer.on(IPC.openPath, listener)
    return () => ipcRenderer.removeListener(IPC.openPath, listener)
  },
  onOpenFolderPath: (cb: (path: string) => void): (() => void) => {
    const listener = (_e: unknown, path: string): void => cb(path)
    ipcRenderer.on(IPC.openFolderPath, listener)
    return () => ipcRenderer.removeListener(IPC.openFolderPath, listener)
  },
  onMenuAction: (cb: (action: string, payload?: string) => void): (() => void) => {
    const listener = (_e: unknown, action: string, payload?: string): void => cb(action, payload)
    ipcRenderer.on(IPC.menuAction, listener)
    return () => ipcRenderer.removeListener(IPC.menuAction, listener)
  },
  onFsChanged: (cb: (event: FsChangeEvent) => void): (() => void) => {
    const listener = (_e: unknown, event: FsChangeEvent): void => cb(event)
    ipcRenderer.on(IPC.fsChanged, listener)
    return () => ipcRenderer.removeListener(IPC.fsChanged, listener)
  },
  onMaximizedChange: (cb: (maximized: boolean) => void): (() => void) => {
    const listener = (_e: unknown, maximized: boolean): void => cb(maximized)
    ipcRenderer.on(IPC.windowMaximizedChanged, listener)
    return () => ipcRenderer.removeListener(IPC.windowMaximizedChanged, listener)
  }
}

export type ScribaApi = typeof api

contextBridge.exposeInMainWorld('api', api)
