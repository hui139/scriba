import { EditorView } from '@codemirror/view'

/**
 * Move the cursor to a 1-based document line and centre it in the viewport.
 *
 * CodeMirror only renders the lines around the viewport, so a distant line has no
 * DOM row to look up (`nth-child(n)` counts rendered rows, not document lines).
 *
 * `EditorView.scrollIntoView` alone is not enough either: it resolves the target
 * through `coordsAt`, which returns `null` for a line that is not currently
 * rendered, and the request is then dropped. So we scroll the scroller ourselves
 * first, using the line's position in CodeMirror's height map (valid for the whole
 * document), and only then move the cursor. The extra `scrollIntoView` effect lets
 * CodeMirror refine the position once the line is rendered, which also corrects
 * for estimated heights in documents with blocks of varying height.
 */
export function goToLine(view: EditorView, lineNumber: number): void {
  const total = view.state.doc.lines
  const target = Math.min(Math.max(1, Math.round(lineNumber)), total)
  const line = view.state.doc.line(target)

  const scroller = view.scrollDOM
  if (scroller.clientHeight > 0) {
    const block = view.lineBlockAt(line.from)
    const centered = block.top - (scroller.clientHeight - block.height) / 2
    scroller.scrollTop = Math.max(0, centered)
  }

  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: 'center' })
  })
  view.focus()
}
