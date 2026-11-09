import { create } from 'zustand'
import type { FileNode } from '@shared/types'

export interface Doc {
  id: string
  path: string | null
  name: string
  content: string
  savedContent: string
  mtimeMs?: number
}

interface WorkspaceState {
  rootPath: string | null
  tree: FileNode[]
  docs: Doc[]
  activeId: string | null
  untitledCounter: number

  setRoot: (path: string | null) => void
  setTree: (tree: FileNode[]) => void
  openDoc: (path: string | null, content: string, mtimeMs?: number) => void
  newDoc: () => string
  closeDoc: (id: string) => void
  setActive: (id: string | null) => void
  updateContent: (id: string, content: string) => void
  markSaved: (id: string, path: string, mtimeMs: number, content?: string) => void
  renamePath: (oldPath: string, newPath: string) => void
  closeByPath: (path: string) => void
  setDocContentFromDisk: (path: string, content: string, mtimeMs: number) => void
}

function baseName(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1]
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  rootPath: null,
  tree: [],
  docs: [],
  activeId: null,
  untitledCounter: 0,

  setRoot: (path) => set({ rootPath: path }),
  setTree: (tree) => set({ tree }),

  openDoc: (path, content, mtimeMs) => {
    const state = get()
    if (path) {
      const existing = state.docs.find((d) => d.path === path)
      if (existing) {
        set({ activeId: existing.id })
        return
      }
    }
    const id = path ?? `untitled:${state.untitledCounter + 1}`
    const doc: Doc = {
      id,
      path,
      name: path ? baseName(path) : `Untitled-${state.untitledCounter + 1}.md`,
      content,
      savedContent: content,
      mtimeMs
    }
    set({
      docs: [...state.docs, doc],
      activeId: id,
      untitledCounter: path ? state.untitledCounter : state.untitledCounter + 1
    })
  },

  newDoc: () => {
    const state = get()
    const n = state.untitledCounter + 1
    const id = `untitled:${n}`
    const doc: Doc = {
      id,
      path: null,
      name: `Untitled-${n}.md`,
      content: '',
      savedContent: ''
    }
    set({ docs: [...state.docs, doc], activeId: id, untitledCounter: n })
    return id
  },

  closeDoc: (id) => {
    const state = get()
    const index = state.docs.findIndex((d) => d.id === id)
    if (index === -1) return
    const docs = state.docs.filter((d) => d.id !== id)
    let activeId = state.activeId
    if (activeId === id) {
      activeId = docs[Math.min(index, docs.length - 1)]?.id ?? null
    }
    set({ docs, activeId })
  },

  setActive: (id) => set({ activeId: id }),

  updateContent: (id, content) => {
    set((state) => ({
      docs: state.docs.map((d) => (d.id === id ? { ...d, content } : d))
    }))
  },

  markSaved: (id, path, mtimeMs, content) => {
    set((state) => ({
      docs: state.docs.map((d) =>
        d.id === id
          ? {
              ...d,
              path,
              name: baseName(path),
              savedContent: content ?? d.content,
              mtimeMs
            }
          : d
      )
    }))
  },

  renamePath: (oldPath, newPath) => {
    set((state) => ({
      docs: state.docs.map((d) =>
        d.path === oldPath ? { ...d, path: newPath, name: baseName(newPath) } : d
      )
    }))
  },

  closeByPath: (path) => {
    const state = get()
    const doc = state.docs.find((d) => d.path === path)
    if (doc) get().closeDoc(doc.id)
  },

  setDocContentFromDisk: (path, content, mtimeMs) => {
    set((state) => ({
      docs: state.docs.map((d) =>
        d.path === path && d.content === d.savedContent
          ? { ...d, content, savedContent: content, mtimeMs }
          : d
      )
    }))
  }
}))
