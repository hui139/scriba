import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SidebarView = 'files' | 'search' | 'outline' | 'plugins'
export type EditorFont = 'serif' | 'sans' | 'mono'

interface SettingsState {
  theme: string
  sidebarVisible: boolean
  sidebarView: SidebarView
  focusMode: boolean
  typewriter: boolean
  fontSize: number
  /** Interface scale, as a percentage. 100 = the design size. */
  uiScale: number
  editorFont: EditorFont
  wordWrap: boolean
  showLineNumbers: boolean
  sourceMode: boolean
  autoSave: boolean
  restoreLastFolder: boolean
  lastFolder: string | null
  /** Auto-close brackets and Markdown pairs ("Auto pair"). */
  autoPair: boolean
  /** Enable the Electron spellchecker. */
  spellcheck: boolean

  setTheme: (theme: string) => void
  setSidebarVisible: (visible: boolean) => void
  toggleSidebar: () => void
  setSidebarView: (view: SidebarView) => void
  setFocusMode: (on: boolean) => void
  toggleFocusMode: () => void
  setTypewriter: (on: boolean) => void
  toggleTypewriter: () => void
  setFontSize: (size: number) => void
  setUiScale: (scale: number) => void
  setEditorFont: (font: EditorFont) => void
  setWordWrap: (on: boolean) => void
  setShowLineNumbers: (on: boolean) => void
  setSourceMode: (on: boolean) => void
  toggleSourceMode: () => void
  setAutoSave: (on: boolean) => void
  setRestoreLastFolder: (on: boolean) => void
  setLastFolder: (path: string | null) => void
  setAutoPair: (on: boolean) => void
  setSpellcheck: (on: boolean) => void
  resetSettings: () => void
}

const defaults = {
  // Ships with the theme drawn from the app artwork, so a fresh install matches the icon.
  theme: 'violet-night',
  sidebarVisible: true,
  sidebarView: 'files' as SidebarView,
  focusMode: false,
  typewriter: false,
  fontSize: 16,
  uiScale: 100,
  editorFont: 'serif' as EditorFont,
  wordWrap: true,
  showLineNumbers: false,
  sourceMode: false,
  autoSave: false,
  restoreLastFolder: true,
  autoPair: true,
  spellcheck: false
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      lastFolder: null,

      setTheme: (theme) => set({ theme }),
      setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
      toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
      setSidebarView: (sidebarView) => set({ sidebarView, sidebarVisible: true }),
      setFocusMode: (focusMode) => set({ focusMode }),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      setTypewriter: (typewriter) => set({ typewriter }),
      toggleTypewriter: () => set((s) => ({ typewriter: !s.typewriter })),
      setFontSize: (fontSize) => set({ fontSize: Math.min(30, Math.max(11, fontSize)) }),
      // Clamped so the interface can never collapse to unreadable or overflow the window.
      setUiScale: (uiScale) =>
        set({ uiScale: Math.min(150, Math.max(80, Math.round(uiScale))) }),
      setEditorFont: (editorFont) => set({ editorFont }),
      setWordWrap: (wordWrap) => set({ wordWrap }),
      setShowLineNumbers: (showLineNumbers) => set({ showLineNumbers }),
      setSourceMode: (sourceMode) => set({ sourceMode }),
      toggleSourceMode: () => set((s) => ({ sourceMode: !s.sourceMode })),
      setAutoSave: (autoSave) => set({ autoSave }),
      setRestoreLastFolder: (restoreLastFolder) => set({ restoreLastFolder }),
      setLastFolder: (lastFolder) => set({ lastFolder }),
      setAutoPair: (autoPair) => set({ autoPair }),
      setSpellcheck: (spellcheck) => set({ spellcheck }),
      resetSettings: () => set((s) => ({ ...defaults, lastFolder: s.lastFolder }))
    }),
    { name: 'scriba-settings' }
  )
)
