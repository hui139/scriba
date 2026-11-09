import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { AppInfo, FileNode } from '@shared/types'
import { Editor } from './editor/Editor'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Tabs } from './components/Tabs'
import { StatusBar } from './components/StatusBar'
import { Welcome } from './components/Welcome'
import { PluginManager } from './components/PluginManager'
import { SettingsDialog } from './components/SettingsDialog'
import { CommandPalette } from './components/CommandPalette'
import { FindBar } from './components/FindBar'
import { useWorkspace } from './store/workspace'
import { useSettings } from './store/settings'
import { useUI } from './store/ui'
import { executeCommand, registerCommand, useRegistry } from './plugins/registry'
import {
  emitPluginEvent,
  loadAllPlugins,
  reloadPlugins,
  usePluginList
} from './plugins/runtime'
import { applyTheme, builtinThemes, themeNameKey, type ThemeOption } from './themes'
import { renderDocumentHtml, renderEpubContent, renderWordHtml } from './markdown/export'
import { renderLatex } from './markdown/latex'
import { insertAtCursor, insertLink, wrapSelection } from './editor/actions'
import {
  changeHeadingLevel,
  clearFormatting,
  insertCodeBlock,
  insertFootnote,
  insertHorizontalRule,
  insertImage,
  insertParagraphBreak,
  insertTable,
  insertToc,
  setHeadingLevel,
  shiftIndent,
  toggleBulletList,
  toggleOrderedList,
  toggleQuote,
  toggleTaskList
} from './editor/blocks'
import { insertPastedImage } from './editor/pasteImage'
import { getCurrentView } from './editor/viewRef'
import { forcePreviewRebuild } from './editor/editState'
import { initializeI18n, useI18n, useT } from './i18n'
import { useShortcuts } from './shortcuts/store'
import { comboFromEvent } from './shortcuts/shortcuts'

type Handler = (payload?: string) => void | Promise<void>

export default function App(): JSX.Element {
  const t = useT()
  const language = useI18n((state) => state.language)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [userThemes, setUserThemes] = useState<ThemeOption[]>([])
  const [exportTemplateCss, setExportTemplateCss] = useState<string | null>(null)
  const [syncToken, setSyncToken] = useState(0)
  const [dropActive, setDropActive] = useState(false)
  const handlersRef = useRef<Record<string, Handler>>({})

  const settings = useSettings()
  const shortcutMap = useShortcuts((state) => state.map)
  const ui = useUI()
  const docs = useWorkspace((state) => state.docs)
  const activeId = useWorkspace((state) => state.activeId)
  const rootPath = useWorkspace((state) => state.rootPath)
  const tree = useWorkspace((state) => state.tree)
  const pluginThemes = useRegistry((state) => state.themes)
  const pluginBindings = useRegistry((state) => state.pluginBindings)
  usePluginList((state) => state.plugins)

  const activeDoc = docs.find((doc) => doc.id === activeId) ?? null

  const allThemes = useMemo<ThemeOption[]>(
    () => [
      ...builtinThemes,
      ...userThemes,
      ...pluginThemes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        kind: 'plugin' as const,
        css: theme.css
      }))
    ],
    [userThemes, pluginThemes]
  )

  useEffect(() => {
    applyTheme(settings.theme, allThemes)
    getCurrentView()?.dispatch({ effects: forcePreviewRebuild.of(null) })
  }, [settings.theme, allThemes])

  // Interface scale. Written to a CSS variable so every `calc(<size>px * var(--ui-scale))`
  // in the stylesheets follows along; document text keeps its own setting.
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale / 100))
  }, [settings.uiScale])

  useEffect(() => {
    getCurrentView()?.dispatch({ effects: forcePreviewRebuild.of(null) })
  }, [language])

  const refreshTree = async (): Promise<void> => {
    const root = useWorkspace.getState().rootPath
    if (!root) return
    try {
      const nodes = await window.api.fs.readDir(root)
      useWorkspace.getState().setTree(nodes)
    } catch {
      // ignore transient errors while the folder is being modified
    }
  }

  const openPath = async (path: string): Promise<void> => {
    const workspace = useWorkspace.getState()
    const existing = workspace.docs.find((doc) => doc.path === path)
    if (existing) {
      workspace.setActive(existing.id)
      return
    }
    try {
      const payload = await window.api.fs.readFile(path)
      useWorkspace.getState().openDoc(payload.path, payload.content, payload.mtimeMs)
      emitPluginEvent('file:open', payload.path)
      void window.api.recent.add(payload.path).then(() => window.api.recent.refreshMenu())
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const openFolderPath = async (path: string): Promise<void> => {
    const workspace = useWorkspace.getState()
    const previous = workspace.rootPath
    if (previous && previous !== path) await window.api.fs.unwatchFolder(previous)
    try {
      const nodes = await window.api.fs.readDir(path)
      workspace.setRoot(path)
      workspace.setTree(nodes)
      useSettings.getState().setLastFolder(path)
      await window.api.fs.watchFolder(path)
      emitPluginEvent('workspace:change', path)
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const openFolder = async (): Promise<void> => {
    const result = await window.api.dialog.openFolder()
    if (!result) return
    await openFolderPath(result.path)
  }

  const openFiles = async (): Promise<void> => {
    const payloads = await window.api.dialog.openFiles()
    for (const payload of payloads) {
      useWorkspace.getState().openDoc(payload.path, payload.content, payload.mtimeMs)
      emitPluginEvent('file:open', payload.path)
    }
  }

  const newDoc = (): void => {
    useWorkspace.getState().newDoc()
  }

  const saveActive = async (forceAs = false): Promise<void> => {
    const workspace = useWorkspace.getState()
    const doc = workspace.docs.find((item) => item.id === workspace.activeId)
    if (!doc) return
    let path = doc.path
    if (!path || forceAs) {
      path = await window.api.dialog.saveAs(doc.path ?? doc.name)
      if (!path) return
    }
    try {
      const result = await window.api.fs.writeFile(path, doc.content)
      useWorkspace.getState().markSaved(doc.id, path, result.mtimeMs, doc.content)
      emitPluginEvent('file:save', path)
      useUI.getState().toast(t('app.saved'), 'success')
      await refreshTree()
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const closeDocById = (id: string): void => {
    const workspace = useWorkspace.getState()
    const doc = workspace.docs.find((item) => item.id === id)
    if (!doc) return
    if (doc.content !== doc.savedContent) {
      if (!window.confirm(t('app.confirmClose', { name: doc.name }))) return
    }
    workspace.closeDoc(id)
  }

  const createEntry = async (
    parentDir: string,
    name: string,
    isDirectory: boolean
  ): Promise<string | null> => {
    try {
      const created = await window.api.fs.createEntry(parentDir, name, isDirectory)
      await refreshTree()
      if (!isDirectory) await openPath(created)
      return created
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
      return null
    }
  }

  const renameEntry = async (path: string, newName: string): Promise<void> => {
    try {
      const result = await window.api.fs.renameEntry(path, newName)
      useWorkspace.getState().renamePath(path, result.path)
      await refreshTree()
      if (result.updatedReferences > 0) {
        useUI.getState().toast(
          t('app.linksUpdated', { count: result.updatedReferences }),
          'success'
        )
      }
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const deleteEntry = async (path: string): Promise<void> => {
    try {
      await window.api.fs.deleteEntry(path)
      useWorkspace.getState().closeByPath(path)
      await refreshTree()
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const exportHtml = async (): Promise<void> => {
    const doc = activeDocFromState()
    if (!doc) return
    try {
      const html = await renderDocumentHtml(doc.content, doc.name, useSettings.getState().theme, { docPath: doc.path, templateCss: exportTemplateCss })
      const target = await window.api.export.html(html, doc.name.replace(/\.md$/i, '') + '.html')
      if (target) useUI.getState().toast(t('app.exportedHtml'), 'success')
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const exportPdf = async (): Promise<void> => {
    const doc = activeDocFromState()
    if (!doc) return
    try {
      const html = await renderDocumentHtml(doc.content, doc.name, useSettings.getState().theme, { docPath: doc.path, templateCss: exportTemplateCss })
      const target = await window.api.export.pdf(html, doc.name.replace(/\.md$/i, '') + '.pdf')
      if (target) useUI.getState().toast(t('app.exportedPdf'), 'success')
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const exportWord = async (): Promise<void> => {
    const doc = activeDocFromState()
    if (!doc) return
    try {
      const html = await renderWordHtml(doc.content, doc.name, useSettings.getState().theme, { docPath: doc.path, templateCss: exportTemplateCss })
      const target = await window.api.export.word(html, doc.name.replace(/\.md$/i, '') + '.doc')
      if (target) useUI.getState().toast(t('app.exportedWord'), 'success')
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const exportText = async (): Promise<void> => {
    const doc = activeDocFromState()
    if (!doc) return
    try {
      const target = await window.api.export.text(doc.content, doc.name.replace(/\.md$/i, '') + '.txt')
      if (target) useUI.getState().toast(t('app.exportedText'), 'success')
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const exportImage = async (): Promise<void> => {
    const doc = activeDocFromState()
    if (!doc) return
    try {
      const html = await renderDocumentHtml(doc.content, doc.name, useSettings.getState().theme, { docPath: doc.path, templateCss: exportTemplateCss })
      const target = await window.api.export.image(html, doc.name.replace(/\.md$/i, '') + '.png')
      if (target) useUI.getState().toast(t('app.exportedImage'), 'success')
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const exportLatex = async (): Promise<void> => {
    const doc = activeDocFromState()
    if (!doc) return
    try {
      const latex = renderLatex(doc.content, doc.name.replace(/\.md$/i, ''))
      const target = await window.api.export.latex(latex, doc.name.replace(/\.md$/i, '') + '.tex')
      if (target) useUI.getState().toast(t('app.exportedLatex'), 'success')
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const exportEpub = async (): Promise<void> => {
    const doc = activeDocFromState()
    if (!doc) return
    try {
      const baseName = doc.name.replace(/\.md$/i, '')
      const { xhtml, css } = await renderEpubContent(doc.content, baseName, useSettings.getState().theme, {
        docPath: doc.path,
        templateCss: exportTemplateCss
      })
      const target = await window.api.export.epub(
        { title: baseName, xhtml, css, docPath: doc.path },
        baseName + '.epub'
      )
      if (target) useUI.getState().toast(t('app.exportedEpub'), 'success')
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const exportFolderContents = async (): Promise<void> => {
    const root = useWorkspace.getState().rootPath
    if (!root) {
      useUI.getState().toast(t('app.noFolderToExport'), 'error')
      return
    }
    try {
      const result = await window.api.export.folder(root)
      if (!result) return
      const size = result.bytesCopied > 1024 * 1024
        ? `${(result.bytesCopied / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(result.bytesCopied / 1024))} KB`
      useUI.getState().toast(
        t('app.folderExported', { count: result.filesCopied, size }),
        'success'
      )
      if (result.skippedLarge > 0) {
        useUI.getState().toast(t('app.folderSkippedLarge', { count: result.skippedLarge }))
      }
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const printDocument = async (): Promise<void> => {
    const doc = activeDocFromState()
    if (!doc) return
    try {
      const html = await renderDocumentHtml(doc.content, doc.name, useSettings.getState().theme, { docPath: doc.path, templateCss: exportTemplateCss })
      const ok = await window.api.export.print(html)
      if (ok) useUI.getState().toast(t('app.printed'), 'success')
    } catch (error) {
      useUI.getState().toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const cycleTheme = (): void => {
    const current = useSettings.getState().theme
    const index = allThemes.findIndex((theme) => theme.id === current)
    const next = allThemes[(index + 1) % allThemes.length]
    if (next) {
      useSettings.getState().setTheme(next.id)
      const nameKey = themeNameKey(next.id)
      useUI.getState().toast(
        t('app.themeSwitched', { name: nameKey ? t(nameKey) : next.name })
      )
    }
  }

  const cycleLanguage = (): void => {
    const i18n = useI18n.getState()
    const index = i18n.languages.findIndex((item) => item.id === i18n.language)
    const next = i18n.languages[(index + 1) % i18n.languages.length]
    if (!next) return
    i18n.setLanguage(next.id)
    useUI.getState().toast(t('app.languageSwitched', { name: next.name }))
  }

  handlersRef.current = {
    'file:new': newDoc,
    'file:open': openFiles,
    'folder:open': openFolder,
    'file:save': () => saveActive(false),
    'file:save-as': () => saveActive(true),
    'export:html': exportHtml,
    'export:pdf': exportPdf,
    'export:word': exportWord,
    'edit:find': () => useUI.getState().setFindOpen(true),
    'palette:open': () => useUI.getState().setPaletteOpen(true),
    'view:sidebar': () => useSettings.getState().toggleSidebar(),
    'view:outline': () => useSettings.getState().setSidebarView('outline'),
    'view:focus': () => useSettings.getState().toggleFocusMode(),
    'view:typewriter': () => useSettings.getState().toggleTypewriter(),
    'view:source': () => {
      useSettings.getState().toggleSourceMode()
      const mode = useSettings.getState().sourceMode
      useUI.getState().toast(t(mode ? 'app.sourceOn' : 'app.sourceOff'))
    },
    'edit:replace': () => useUI.getState().setFindOpen(true),
    'plugins:manage': () => useUI.getState().setPluginManagerOpen(true),
    'settings:open': () => useUI.getState().setSettingsOpen(true),
    'plugins:reload': reloadPlugins,
    'plugins:open-dir': () => {
      void window.api.plugins.openDir()
    },
    'themes:open-dir': () => {
      void window.api.themes.openDir()
    },
    'theme:cycle': cycleTheme,
    'language:cycle': cycleLanguage,
    'format:heading': (payload?: string) => {
      const level = Number(payload ?? '1')
      if (level >= 0 && level <= 6) setHeadingLevel(level as 0 | 1 | 2 | 3 | 4 | 5 | 6)
    },
    'format:bold': () => wrapSelection('**'),
    'format:italic': () => wrapSelection('*'),
    'format:underline': () => wrapSelection('<u>', '</u>'),
    'format:strike': () => wrapSelection('~~'),
    'format:highlight': () => wrapSelection('=='),
    'format:sup': () => wrapSelection('^'),
    'format:sub': () => wrapSelection('~'),
    'format:code': () => wrapSelection('`'),
    'format:clear': clearFormatting,
    'format:quote': toggleQuote,
    'format:bullet-list': toggleBulletList,
    'format:ordered-list': toggleOrderedList,
    'format:task-list': toggleTaskList,
    'format:indent': () => shiftIndent(1),
    'format:outdent': () => shiftIndent(-1),
    'format:promote': () => changeHeadingLevel(1),
    'format:demote': () => changeHeadingLevel(-1),
    'insert:link': () => insertLink(),
    'insert:image': insertImage,
    'insert:table': () => insertTable(),
    'insert:math': () => insertAtCursor('$$\n\n$$'),
    'insert:hr': insertHorizontalRule,
    'insert:code-block': () => insertCodeBlock(),
    'insert:footnote': insertFootnote,
    'insert:toc': insertToc,
    'insert:paragraph-before': () => insertParagraphBreak(true),
    'insert:paragraph-after': () => insertParagraphBreak(false),
    'insert:mermaid': () => insertAtCursor('\n```mermaid\ngraph TD\n  A --> B\n```\n'),
    'file:print': printDocument,
    'export:text': exportText,
    'export:image': exportImage,
    'export:latex': exportLatex,
    'export:epub': exportEpub,
    'export:folder': exportFolderContents,
    'file:open-recent': (payload?: string) => (payload ? openPath(payload) : undefined),
    'file:clear-recent': async () => {
      await window.api.recent.clear()
      await window.api.recent.refreshMenu()
      useUI.getState().toast(t('app.recentCleared'))
    }
  }

  // Maps the user's bound combos to the same actions the menu uses. Built from the
  // shortcut map so a rebind in Settings is picked up on the next keypress.
  const shortcutAction = (id: string): (() => void) | null => {
    switch (id) {
      // Inline formatting
      case 'bold':
        return () => wrapSelection('**')
      case 'italic':
        return () => wrapSelection('*')
      case 'underline':
        return () => wrapSelection('<u>', '</u>')
      case 'strike':
        return () => wrapSelection('~~')
      case 'highlight':
        return () => wrapSelection('==')
      case 'inlineCode':
        return () => wrapSelection('`')
      case 'link':
        return () => insertLink()
      case 'clearFormat':
        return clearFormatting

      // Paragraph
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'heading4':
      case 'heading5':
      case 'heading6': {
        const level = Number(id.slice(-1)) as 1 | 2 | 3 | 4 | 5 | 6
        return () => setHeadingLevel(level)
      }
      case 'paragraph':
        return () => setHeadingLevel(0)
      case 'promoteHeading':
        return () => changeHeadingLevel(1)
      case 'demoteHeading':
        return () => changeHeadingLevel(-1)
      case 'quote':
        return toggleQuote
      case 'orderedList':
        return toggleOrderedList
      case 'bulletList':
        return toggleBulletList
      case 'taskList':
        return toggleTaskList
      case 'indent':
        return () => shiftIndent(1)
      case 'outdent':
        return () => shiftIndent(-1)

      // Insert
      case 'insertTable':
        return () => insertTable()
      case 'insertCodeBlock':
        return () => insertCodeBlock()
      case 'insertMath':
        return () => insertAtCursor('$$\n\n$$')
      case 'insertImage':
        return insertImage
      case 'insertFootnote':
        return insertFootnote
      case 'insertHr':
        return insertHorizontalRule

      // View
      case 'find':
      case 'replace':
        return () => useUI.getState().setFindOpen(true)
      case 'palette':
        return () => useUI.getState().setPaletteOpen(true)
      case 'sourceMode':
        return () => {
          useSettings.getState().toggleSourceMode()
          const mode = useSettings.getState().sourceMode
          useUI.getState().toast(t(mode ? 'app.sourceOn' : 'app.sourceOff'))
        }
      case 'sidebar':
        return () => useSettings.getState().toggleSidebar()
      case 'settings':
        return () => useUI.getState().setSettingsOpen(true)
      case 'focusMode':
        return () => useSettings.getState().toggleFocusMode()
      case 'typewriter':
        return () => useSettings.getState().toggleTypewriter()

      // File
      case 'save':
        return () => void saveActive(false)
      case 'saveAs':
        return () => void saveActive(true)
      case 'newFile':
        return () => void newDoc()
      case 'openFile':
        return () => void openFiles()
      case 'openFolder':
        return () => void openFolder()

      default:
        return null
    }
  }

  const comboActions: Record<string, () => void> = {}
  for (const [id, combo] of Object.entries(shortcutMap)) {
    if (!combo) continue
    const action = shortcutAction(id)
    if (action) comboActions[combo] = action
  }

  // Plugin-contributed keybindings run their command through the registry. A user
  // binding always wins: the loop above is applied first, so plugins only fill
  // combos the user has not claimed.
  for (const [commandId, binding] of Object.entries(pluginBindings)) {
    if (!binding.combo || comboActions[binding.combo]) continue
    comboActions[binding.combo] = () => void executeCommand(commandId)
  }

  useEffect(() => {
    // The spellchecker lives on the Electron session, so it is applied through the
    // main process whenever the preference changes.
    void window.api.window.setSpellcheck(settings.spellcheck)
  }, [settings.spellcheck])

  useEffect(() => {
    const off = window.api.onMenuAction((action, payload) => {
      const handler = handlersRef.current[action]
      if (handler) void handler(payload)
    })
    return off
  }, [])

  useEffect(() => {
    const doc = activeDocFromState()
    if (doc) emitPluginEvent('doc:change', doc.content)
  }, [activeId])

  useEffect(() => {
    const off = window.api.onOpenPath((path) => {
      void openPath(path)
    })
    return off
  }, [])

  useEffect(() => {
    const off = window.api.onOpenFolderPath((path) => {
      void openFolderPath(path)
    })
    return off
  }, [])

  useEffect(() => {
    const off = window.api.onFsChanged((event) => {
      void refreshTree()
      if (event.type === 'change') {
        const workspace = useWorkspace.getState()
        const doc = workspace.docs.find((item) => item.path === event.path)
        if (doc && doc.content === doc.savedContent) {
          void window.api.fs
            .readFile(event.path)
            .then((payload) => {
              useWorkspace
                .getState()
                .setDocContentFromDisk(event.path, payload.content, payload.mtimeMs)
              setSyncToken((value) => value + 1)
            })
            .catch(() => undefined)
        }
      }
    })
    return off
  }, [])

  useEffect(() => {
    if (!settings.autoSave) return
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    const clearTimer = (id: string): void => {
      const timer = timers.get(id)
      if (timer) {
        clearTimeout(timer)
        timers.delete(id)
      }
    }

    const sync = (state: ReturnType<typeof useWorkspace.getState>): void => {
      for (const doc of state.docs) {
        if (!doc.path || doc.content === doc.savedContent) {
          clearTimer(doc.id)
          continue
        }
        if (timers.has(doc.id)) continue
        timers.set(
          doc.id,
          setTimeout(() => {
            timers.delete(doc.id)
            const current = useWorkspace.getState().docs.find((item) => item.id === doc.id)
            if (!current?.path || current.content === current.savedContent) return
            const path = current.path
            const content = current.content
            void window.api.fs
              .writeFile(path, content)
              .then((result) => {
                const latest = useWorkspace.getState().docs.find((item) => item.id === doc.id)
                if (!latest) return
                useWorkspace.getState().markSaved(latest.id, path, result.mtimeMs, content)
                emitPluginEvent('file:save', path)
              })
              .catch((error) => {
                useUI
                  .getState()
                  .toast(error instanceof Error ? error.message : String(error), 'error')
              })
          }, 1000)
        )
      }

      for (const [id, timer] of timers) {
        if (!state.docs.some((doc) => doc.id === id)) {
          clearTimeout(timer)
          timers.delete(id)
        }
      }
    }

    sync(useWorkspace.getState())
    const unsubscribe = useWorkspace.subscribe(sync)
    return () => {
      unsubscribe()
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [settings.autoSave])

  useEffect(() => {
    const definitions: Array<{
      id: string
      nameKey: string
      hint?: string
      action: string
    }> = [
      { id: 'core.new', nameKey: 'command.new', hint: 'Ctrl+N', action: 'file:new' },
      { id: 'core.open-file', nameKey: 'command.openFile', hint: 'Ctrl+O', action: 'file:open' },
      {
        id: 'core.open-folder',
        nameKey: 'command.openFolder',
        hint: 'Ctrl+Shift+O',
        action: 'folder:open'
      },
      { id: 'core.save', nameKey: 'command.save', hint: 'Ctrl+S', action: 'file:save' },
      {
        id: 'core.save-as',
        nameKey: 'command.saveAs',
        hint: 'Ctrl+Shift+S',
        action: 'file:save-as'
      },
      { id: 'core.export-html', nameKey: 'command.exportHtml', action: 'export:html' },
      { id: 'core.export-pdf', nameKey: 'command.exportPdf', action: 'export:pdf' },
      { id: 'core.export-word', nameKey: 'command.exportWord', action: 'export:word' },
      { id: 'core.find', nameKey: 'command.find', hint: 'Ctrl+F', action: 'edit:find' },
      {
        id: 'core.replace',
        nameKey: 'command.replace',
        hint: 'Ctrl+H',
        action: 'edit:replace'
      },
      {
        id: 'core.toggle-sidebar',
        nameKey: 'command.toggleSidebar',
        hint: 'Ctrl+\\',
        action: 'view:sidebar'
      },
      { id: 'core.outline', nameKey: 'command.outline', action: 'view:outline' },
      {
        id: 'core.focus-mode',
        nameKey: 'command.focus',
        hint: 'F8',
        action: 'view:focus'
      },
      {
        id: 'core.typewriter',
        nameKey: 'command.typewriter',
        hint: 'F9',
        action: 'view:typewriter'
      },
      {
        id: 'core.source-mode',
        nameKey: 'command.sourceMode',
        hint: 'Ctrl+/',
        action: 'view:source'
      },
      { id: 'core.theme', nameKey: 'command.theme', action: 'theme:cycle' },
      { id: 'core.language', nameKey: 'command.language', action: 'language:cycle' },
      {
        id: 'core.settings',
        nameKey: 'command.settings',
        hint: 'Ctrl+,',
        action: 'settings:open'
      },
      { id: 'core.plugins', nameKey: 'command.plugins', action: 'plugins:manage' },
      { id: 'core.reload-plugins', nameKey: 'command.reloadPlugins', action: 'plugins:reload' },
      { id: 'core.bold', nameKey: 'command.bold', hint: 'Ctrl+B', action: 'format:bold' },
      { id: 'core.italic', nameKey: 'command.italic', hint: 'Ctrl+I', action: 'format:italic' },
      {
        id: 'core.underline',
        nameKey: 'command.underline',
        hint: 'Ctrl+U',
        action: 'format:underline'
      },
      {
        id: 'core.strike',
        nameKey: 'command.strike',
        hint: 'Ctrl+Shift+X',
        action: 'format:strike'
      },
      {
        id: 'core.highlight',
        nameKey: 'command.highlight',
        hint: 'Ctrl+Shift+H',
        action: 'format:highlight'
      },
      { id: 'core.sup', nameKey: 'command.superscript', action: 'format:sup' },
      { id: 'core.sub', nameKey: 'command.subscript', action: 'format:sub' },
      { id: 'core.code', nameKey: 'command.code', action: 'format:code' },
      { id: 'core.link', nameKey: 'command.link', hint: 'Ctrl+K', action: 'insert:link' },
      { id: 'core.image', nameKey: 'command.image', action: 'insert:image' },
      { id: 'core.table', nameKey: 'command.table', action: 'insert:table' },
      { id: 'core.math', nameKey: 'command.math', action: 'insert:math' },
      { id: 'core.mermaid', nameKey: 'command.mermaid', action: 'insert:mermaid' }
    ]
    for (const definition of definitions) {
      registerCommand({
        id: definition.id,
        name: definition.nameKey,
        nameKey: definition.nameKey,
        hint: definition.hint,
        run: () => handlersRef.current[definition.action]?.()
      })
    }
  }, [])

  useEffect(() => {
    initializeI18n()
    void (async () => {
      setAppInfo(await window.api.app.info())
      const themes = await window.api.themes.list()
      setUserThemes(
        themes.map((theme) => ({
          id: theme.id,
          name: theme.name,
          kind: 'user' as const,
          css: theme.css
        }))
      )
      await loadAllPlugins()
      emitPluginEvent('editor:ready')

      // Apply the first user export template, if any, to every export.
      try {
        const templates = await window.api.exportTemplates.list()
        if (templates.length > 0) setExportTemplateCss(templates[0].css)
      } catch {
        // Export still works without a template.
      }

      const last = useSettings.getState().lastFolder
      if (useSettings.getState().restoreLastFolder && last && (await window.api.fs.exists(last))) {
        const nodes = await window.api.fs.readDir(last)
        useWorkspace.getState().setRoot(last)
        useWorkspace.getState().setTree(nodes)
        await window.api.fs.watchFolder(last)
        emitPluginEvent('workspace:change', last)
      }
    })()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target
      // Never steal typing from inputs (including rendered table cells) or from
      // dialogs such as Settings and the command palette.
      if (
        (target instanceof Element && target.closest('input, textarea, select')) ||
        document.querySelector('.modal-backdrop')
      ) {
        return
      }

      // Resolve the pressed combo against the user's bindings, so rebinding a key in
      // Settings takes effect here without touching this handler.
      const combo = comboFromEvent(event)
      if (!combo) return
      const action = comboActions[combo]
      if (!action) return

      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // `pluginBindings` is included so shortcuts registered by a plugin that loads
    // after mount take effect without requiring a remount.
  }, [shortcutMap, pluginBindings])

  const handleDrop = async (event: DragEvent): Promise<void> => {
    event.preventDefault()
    setDropActive(false)
    const files = Array.from(event.dataTransfer.files)
    const doc = activeDocFromState()

    for (const file of files) {
      const isImage =
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(file.name)

      // Dropping an image into the editor imports it like a pasted screenshot.
      if (isImage && doc) {
        const view = getCurrentView()
        if (view) {
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
          if (pos != null) view.dispatch({ selection: { anchor: pos } })
          await insertPastedImage(view, file, doc.path)
          continue
        }
      }

      const path = window.api.files.getPath(file)
      if (path) await openPath(path)
    }
  }

  const platform = appInfo?.platform ?? 'win32'

  return (
    <div
      className="app"
      onDragOver={(event) => {
        event.preventDefault()
        setDropActive(true)
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(event) => void handleDrop(event)}
    >
      <TitleBar
        platform={platform}
        sidebarVisible={settings.sidebarVisible}
        onToggleSidebar={() => settings.toggleSidebar()}
        onOpenFolder={() => void openFolder()}
        onOpenPlugins={() => ui.setPluginManagerOpen(true)}
        onOpenSettings={() => ui.setSettingsOpen(true)}
        onOpenPalette={() => ui.setPaletteOpen(true)}
      />

      <div className="body">
        <Sidebar
          rootPath={rootPath}
          tree={tree}
          activeDocPath={activeDoc?.path ?? null}
          activeDocContent={activeDoc?.content ?? ''}
          view={settings.sidebarView}
          visible={settings.sidebarVisible}
          onSetView={(view) => settings.setSidebarView(view)}
          onOpenFolder={() => void openFolder()}
          onRefresh={() => void refreshTree()}
          onOpenFile={(node: FileNode) => void openPath(node.path)}
          onCreate={createEntry}
          onRename={renameEntry}
          onDelete={deleteEntry}
        />

        <main className="main">
          <Tabs
            docs={docs}
            activeId={activeId}
            onSelect={(id) => useWorkspace.getState().setActive(id)}
            onClose={closeDocById}
            onNew={newDoc}
          />
          <div className="editor-area">
            {activeDoc ? (
              <Editor
                docId={activeDoc.id}
                content={activeDoc.content}
                docPath={activeDoc.path}
                syncToken={syncToken}
                typewriter={settings.typewriter}
                focusMode={settings.focusMode}
                fontSize={settings.fontSize}
                editorFont={settings.editorFont}
                lineNumbers={settings.showLineNumbers}
                wordWrap={settings.wordWrap}
                sourceMode={settings.sourceMode}
                autoPair={settings.autoPair}
                onChange={(id, text) => {
                  useWorkspace.getState().updateContent(id, text)
                  emitPluginEvent('doc:change', text)
                }}
                onCursor={(line, col, words, chars) => {
                  ui.setCursor(line, col)
                  ui.setStats(words, chars)
                }}
              />
            ) : (
              <Welcome
                onNew={newDoc}
                onOpenFile={() => void openFiles()}
                onOpenFolder={() => void openFolder()}
              />
            )}
            {dropActive && <div className="drag-overlay">{t('app.dropHint')}</div>}
          </div>
          <StatusBar
            sourceMode={settings.sourceMode}
            onToggleSource={() => settings.toggleSourceMode()}
          />
        </main>
      </div>

      <PluginManager
        open={ui.pluginManagerOpen}
        onClose={() => ui.setPluginManagerOpen(false)}
        appVersion={appInfo?.version ?? '0.0.0'}
      />
      <SettingsDialog
        open={ui.settingsOpen}
        onClose={() => ui.setSettingsOpen(false)}
        themes={allThemes}
        appInfo={appInfo}
      />
      <CommandPalette open={ui.paletteOpen} onClose={() => ui.setPaletteOpen(false)} />
      <FindBar open={ui.findOpen} onClose={() => ui.setFindOpen(false)} />

      <div className="toast-container">
        {ui.toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

function activeDocFromState(): { content: string; name: string; path: string | null } | null {
  const workspace = useWorkspace.getState()
  const doc = workspace.docs.find((item) => item.id === workspace.activeId)
  if (!doc) return null
  return { content: doc.content, name: doc.name, path: doc.path }
}
