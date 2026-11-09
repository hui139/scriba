import { getCurrentView } from './viewRef'

export function insertAtCursor(text: string): void {
  const view = getCurrentView()
  if (!view) return
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length }
  })
  view.focus()
}

export function wrapSelection(before: string, after = before): void {
  const view = getCurrentView()
  if (!view) return
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + selected.length }
  })
  view.focus()
}

/**
 * Insert a Markdown link. A selection becomes the link label and the URL
 * placeholder is selected so it can be typed over right away; with no selection
 * the label placeholder is selected instead.
 */
export function insertLink(): void {
  const view = getCurrentView()
  if (!view) return
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  if (selected) {
    const before = `[${selected}](`
    const url = 'https://'
    const insert = `${before}${url})`
    const urlFrom = from + before.length
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: urlFrom, head: urlFrom + url.length }
    })
  } else {
    const insert = '[](https://)'
    view.dispatch({
      changes: { from, insert },
      selection: { anchor: from + 1 }
    })
  }
  view.focus()
}

export function insertBlock(text: string): void {
  const view = getCurrentView()
  if (!view) return
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const prefix = line.from === from ? '' : '\n'
  view.dispatch({
    changes: { from, insert: `${prefix}${text}` },
    selection: { anchor: from + prefix.length + text.length }
  })
  view.focus()
}
