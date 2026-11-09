import type { EditorView } from '@codemirror/view'

let currentView: EditorView | null = null

export function setCurrentView(view: EditorView | null): void {
  currentView = view
}

export function getCurrentView(): EditorView | null {
  return currentView
}
