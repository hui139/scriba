import { EditorView } from '@codemirror/view'
import { HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

export const scribaTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--text)',
    backgroundColor: 'transparent',
    fontSize: 'var(--editor-font-size)'
  },
  '.cm-scroller': {
    fontFamily: 'var(--editor-font, var(--font-body))',
    lineHeight: '1.75',
    overflow: 'auto'
  },
  '.cm-content': {
    maxWidth: '780px',
    width: '100%',
    margin: '0 auto',
    padding: '24px 8px 45vh',
    fontFamily: 'var(--editor-font, var(--font-body))',
    caretColor: 'var(--accent)'
  },
  '.cm-line': {
    padding: '0 4px'
  },
  '.cm-focused': {
    outline: 'none'
  },
  '.cm-placeholder': {
    color: 'var(--text-muted)'
  },
  '.cm-selectionMatch': {
    backgroundColor: 'var(--accent-soft)'
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
    boxShadow: 'var(--shadow)'
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)'
  },
  '.cm-panels': {
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderColor: 'var(--border)'
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--accent-soft)',
    outline: '1px solid var(--accent)'
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--selection)'
  }
})

export const scribaHighlight = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--accent)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--success)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: [t.number, t.bool, t.null], color: 'var(--code-text)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--accent)' },
  { tag: [t.typeName, t.className], color: 'var(--success)' },
  { tag: t.operator, color: 'var(--text-secondary)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--text)' },
  { tag: t.meta, color: 'var(--text-muted)' },
  { tag: t.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--text-muted)' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.heading, fontWeight: '700', color: 'var(--text)' },
  { tag: t.quote, color: 'var(--text-secondary)' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)' }
])

let typewriterEnabled = false

export function setTypewriterEnabled(enabled: boolean): void {
  typewriterEnabled = enabled
}

export const typewriterListener = EditorView.updateListener.of((update) => {
  if (!typewriterEnabled || !update.selectionSet) return
  const head = update.state.selection.main.head
  const coords = update.view.coordsAtPos(head)
  if (!coords) return
  const rect = update.view.scrollDOM.getBoundingClientRect()
  const target = rect.top + rect.height / 2
  const delta = coords.top - target
  if (Math.abs(delta) > 2) {
    update.view.scrollDOM.scrollTop += delta
  }
})
