import { EditorSelection } from '@codemirror/state'
import { getCurrentView } from './viewRef'

/**
 * Block-level Markdown transformations behind the "Paragraph" and
 * "Insert" menus. Everything here operates on whole lines so that the live
 * preview keeps working: the widgets only need well-formed block markers.
 */

function withView(fn: (view: NonNullable<ReturnType<typeof getCurrentView>>) => void): void {
  const view = getCurrentView()
  if (!view) return
  fn(view)
  view.focus()
}

/** Every line number touched by the current selection, in document order. */
function selectedLines(view: NonNullable<ReturnType<typeof getCurrentView>>): number[] {
  const { from, to } = view.state.selection.main
  const first = view.state.doc.lineAt(from).number
  const last = view.state.doc.lineAt(to).number
  const lines: number[] = []
  for (let n = first; n <= last; n++) lines.push(n)
  return lines
}

const HEADING_RE = /^(#{1,6})\s+/
const QUOTE_RE = /^(\s*)>\s?/
const UL_RE = /^(\s*)[-*+]\s+(?!\[[ xX]\]\s)/
const OL_RE = /^(\s*)(\d+)[.)]\s+/
const TASK_RE = /^(\s*)[-*+]\s+\[[ xX]\]\s+/

/**
 * Applies `transform` to the text of every selected line in a single dispatch,
 * so the change is one undo step. Line contents keep their offsets because we
 * rewrite whole lines from a snapshot taken before dispatching.
 */
function rewriteLines(
  view: NonNullable<ReturnType<typeof getCurrentView>>,
  transform: (text: string, lineNumber: number) => string
): void {
  const numbers = selectedLines(view)
  const changes: Array<{ from: number; to: number; insert: string }> = []
  for (const number of numbers) {
    const line = view.state.doc.line(number)
    const next = transform(line.text, number)
    if (next !== line.text) changes.push({ from: line.from, to: line.to, insert: next })
  }
  if (changes.length === 0) return
  view.dispatch({ changes })
}

/** Sets the heading level (1-6) of the selected lines, or 0 for a paragraph. */
export function setHeadingLevel(level: 0 | 1 | 2 | 3 | 4 | 5 | 6): void {
  withView((view) => {
    rewriteLines(view, (text) => {
      const stripped = text.replace(HEADING_RE, '')
      if (level === 0) return stripped
      return `${'#'.repeat(level)} ${stripped}`
    })
  })
}

/** Heading level of the line holding the cursor, or 0 when it is a paragraph. */
export function currentHeadingLevel(): number {
  const view = getCurrentView()
  if (!view) return 0
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const match = HEADING_RE.exec(line.text)
  return match ? match[1].length : 0
}

/** Ctrl+= / Ctrl+-: promote or demote the current heading. */
export function changeHeadingLevel(delta: number): void {
  const next = Math.min(6, Math.max(0, currentHeadingLevel() + delta))
  setHeadingLevel(next as 0 | 1 | 2 | 3 | 4 | 5 | 6)
}

export function toggleQuote(): void {
  withView((view) => {
    rewriteLines(view, (text) => {
      const match = QUOTE_RE.exec(text)
      return match ? text.slice(match[0].length) : `> ${text}`
    })
  })
}

export function toggleBulletList(): void {
  withView((view) => {
    rewriteLines(view, (text) => {
      const task = TASK_RE.exec(text)
      if (task) return text.slice(task[0].length)
      const bullet = UL_RE.exec(text)
      if (bullet) return text.slice(bullet[0].length)
      const ordered = OL_RE.exec(text)
      if (ordered) return text.slice(ordered[0].length)
      const quote = QUOTE_RE.exec(text)
      if (quote) return `${quote[1]}- ${text.slice(quote[0].length)}`
      return `- ${text}`
    })
  })
}

export function toggleOrderedList(): void {
  withView((view) => {
    let counter = 0
    rewriteLines(view, (text) => {
      const ordered = OL_RE.exec(text)
      if (ordered) return text.slice(ordered[0].length)
      const bullet = UL_RE.exec(text)
      const task = TASK_RE.exec(text)
      const quote = QUOTE_RE.exec(text)
      const indent = bullet?.[1] ?? task?.[1] ?? quote?.[1] ?? ''
      const body = bullet
        ? text.slice(bullet[0].length)
        : task
          ? text.slice(task[0].length)
          : quote
            ? text.slice(quote[0].length)
            : text
      counter += 1
      return `${indent}${counter}. ${body}`
    })
  })
}

export function toggleTaskList(): void {
  withView((view) => {
    rewriteLines(view, (text) => {
      const task = TASK_RE.exec(text)
      if (task) return text.slice(task[0].length)
      const bullet = UL_RE.exec(text)
      if (bullet) return `${bullet[1]}- [ ] ${text.slice(bullet[0].length)}`
      const ordered = OL_RE.exec(text)
      if (ordered) return `${ordered[1]}- [ ] ${text.slice(ordered[0].length)}`
      const quote = QUOTE_RE.exec(text)
      if (quote) return `${quote[1]}- [ ] ${text.slice(quote[0].length)}`
      return `- [ ] ${text}`
    })
  })
}

/** Indent (+) or outdent (-) the selected lines by two spaces, like Tab/Shift+Tab. */
export function shiftIndent(direction: 1 | -1): void {
  withView((view) => {
    rewriteLines(view, (text) => {
      if (direction === 1) return `  ${text}`
      if (text.startsWith('  ')) return text.slice(2)
      if (text.startsWith('\t')) return text.slice(1)
      return text
    })
  })
}

/**
 * Removes inline emphasis markers from the selection ("Clear Format").
 * Only well-known symmetric delimiters are stripped, so ordinary text is intact.
 */
export function clearFormatting(): void {
  withView((view) => {
    const { from, to } = view.state.selection.main
    if (from === to) return
    const raw = view.state.sliceDoc(from, to)
    const cleaned = raw
      .replace(/<\/?(?:u|mark|sup|sub|span|font|strong|em|b|i)\b[^>]*>/gi, '')
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/==(.+?)==/g, '$1')
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
      .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
    if (cleaned === raw) return
    view.dispatch({ changes: { from, to, insert: cleaned }, selection: EditorSelection.range(from, from + cleaned.length) })
  })
}

/** Wraps the selection as a link target, or inserts an image placeholder. */
export function insertImage(): void {
  withView((view) => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const alt = selected || 'alt'
    const insert = `![${alt}](path/to/image.png)`
    const urlFrom = from + alt.length + 4
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.range(urlFrom, urlFrom + 'path/to/image.png'.length)
    })
  })
}

/** Inserts a fenced code block on its own paragraph and puts the cursor inside. */
export function insertCodeBlock(language = ''): void {
  withView((view) => {
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const prefix = line.text.trim() ? '\n\n' : ''
    const text = `${prefix}\`\`\`${language}\n\n\`\`\`\n`
    view.dispatch({
      changes: { from: line.to, insert: text },
      selection: EditorSelection.cursor(line.to + prefix.length + 3 + language.length + 1)
    })
  })
}

export function insertHorizontalRule(): void {
  withView((view) => {
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const prefix = line.text.trim() ? '\n\n' : ''
    const text = `${prefix}---\n`
    view.dispatch({
      changes: { from: line.to, insert: text },
      selection: EditorSelection.cursor(line.to + text.length)
    })
  })
}

/**
 * Footnote definition plus its reference: the reference goes at
 * the cursor and the definition is appended at the end of the document.
 */
export function insertFootnote(): void {
  withView((view) => {
    const doc = view.state.doc.toString()
    const existing = doc.match(/\[\^(\d+)\]:/g) ?? []
    const nextNumber = existing.length + 1
    const label = `^${nextNumber}`
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)

    const tail = doc.length > 0 && !doc.endsWith('\n') ? '\n' : ''
    const definition = `${tail}\n[${label}]: `
    view.dispatch({
      changes: [
        { from, to, insert: `${selected}[${label}]` },
        { from: view.state.doc.length, insert: definition }
      ],
      selection: EditorSelection.cursor(view.state.doc.length + definition.length)
    })
  })
}

/** Inserts a `[TOC]` marker on its own paragraph as a table of contents. */
export function insertToc(): void {
  withView((view) => {
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const prefix = line.text.trim() ? '\n\n' : ''
    const text = `${prefix}[TOC]\n`
    view.dispatch({
      changes: { from: line.to, insert: text },
      selection: EditorSelection.cursor(line.to + text.length)
    })
  })
}

/** Inserts an empty GFM table with a header row and two columns. */
export function insertTable(rows = 2, cols = 3): void {
  withView((view) => {
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const prefix = line.text.trim() ? '\n\n' : ''
    const header = `| ${Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(' | ')} |`
    const divider = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`
    const body = Array.from(
      { length: rows },
      () => `| ${Array.from({ length: cols }, () => '   ').join(' | ')} |`
    ).join('\n')
    const text = `${prefix}${header}\n${divider}\n${body}\n`
    view.dispatch({
      changes: { from: line.to, insert: text },
      selection: EditorSelection.cursor(line.to + text.length)
    })
  })
}

/** Adds a paragraph break before or after the current block (Ctrl+Enter). */
export function insertParagraphBreak(before: boolean): void {
  withView((view) => {
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const at = before ? line.from : line.to
    view.dispatch({
      changes: { from: at, insert: '\n' },
      selection: EditorSelection.cursor(at + 1)
    })
  })
}
