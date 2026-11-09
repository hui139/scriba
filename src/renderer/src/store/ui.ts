import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  type: 'info' | 'error' | 'success'
}

interface UIState {
  toasts: Toast[]
  pluginManagerOpen: boolean
  settingsOpen: boolean
  paletteOpen: boolean
  findOpen: boolean
  activeLine: number
  cursorLine: number
  cursorCol: number
  wordCount: number
  charCount: number
  outlineTick: number

  toast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: number) => void
  setPluginManagerOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setPaletteOpen: (open: boolean) => void
  setFindOpen: (open: boolean) => void
  setCursor: (line: number, col: number) => void
  setStats: (words: number, chars: number) => void
  bumpOutline: () => void
}

let toastId = 0

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  pluginManagerOpen: false,
  settingsOpen: false,
  paletteOpen: false,
  findOpen: false,
  activeLine: 1,
  cursorLine: 1,
  cursorCol: 1,
  wordCount: 0,
  charCount: 0,
  outlineTick: 0,

  toast: (message, type = 'info') => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().dismissToast(id), 2600)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setPluginManagerOpen: (pluginManagerOpen) => set({ pluginManagerOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setFindOpen: (findOpen) => set({ findOpen }),
  setCursor: (cursorLine, cursorCol) => set({ cursorLine, cursorCol, activeLine: cursorLine }),
  setStats: (wordCount, charCount) => set({ wordCount, charCount }),
  bumpOutline: () => set((s) => ({ outlineTick: s.outlineTick + 1 }))
}))
