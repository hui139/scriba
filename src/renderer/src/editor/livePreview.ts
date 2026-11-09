import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { EditorState, StateField, type Range } from '@codemirror/state'
import { forcePreviewRebuild } from './editState'
import { codeRendererMap } from '../plugins/registry'
import {
  BulletWidget,
  CheckboxWidget,
  CustomCodeWidget,
  EmptyWidget,
  HrWidget,
  ImageWidget,
  MathWidget,
  MermaidWidget,
  TableWidget,
  TocWidget,
  type TableCellData,
  type TableData,
  type TocHeading
} from './widgets'

import { getPreviewDocPath, setPreviewDocPath } from './docPath'
import { parseImageToken } from '../markdown/imageSize'

/** CSS class for each supported inline HTML tag. */
const HTML_INLINE_CLASS: Record<string, string> = {
  u: 'cm-md-underline',
  mark: 'cm-md-highlight',
  sup: 'cm-md-sup',
  sub: 'cm-md-sub'
}

export { setPreviewDocPath }


function themeName(): string {
  return document.documentElement.dataset.theme ?? 'dark'
}

function findClosingFence(state: EditorState, startLine: number, char: string, length: number): number {
  for (let j = startLine + 1; j <= state.doc.lines; j++) {
    const match = /^\s*(`{3,}|~{3,})\s*$/.exec(state.doc.line(j).text)
    if (match && match[1][0] === char && match[1].length >= length) return j
  }
  return 0
}

/**
 * Split one GFM table row into cells, keeping the document offset of each cell's
 * trimmed text so that clicking a cell can put the cursor exactly there.
 * Returns `null` when the line is not a table row (no unescaped pipe).
 */
function splitTableRow(text: string, lineFrom: number): TableCellData[] | null {
  if (!text.includes('|')) return null

  const segments: Array<{ text: string; from: number }> = []
  let buffer = ''
  let bufferFrom = 0
  let sawPipe = false
  let i = 0

  while (i < text.length) {
    const char = text[i]
    if (char === '\\' && text[i + 1] === '|') {
      if (!buffer) bufferFrom = i
      buffer += '|'
      i += 2
      continue
    }
    if (char === '|') {
      sawPipe = true
      segments.push({ text: buffer, from: bufferFrom })
      buffer = ''
      bufferFrom = i + 1
      i++
      continue
    }
    if (!buffer) bufferFrom = i
    buffer += char
    i++
  }
  segments.push({ text: buffer, from: bufferFrom })
  if (!sawPipe) return null

  // A leading pipe produces an empty first segment, a trailing pipe an empty last
  // one; both are delimiters rather than cells.
  if (segments.length > 1 && segments[0].text.trim() === '' && /^\s*\|/.test(text)) {
    segments.shift()
  }
  if (
    segments.length > 1 &&
    segments[segments.length - 1].text.trim() === '' &&
    /\|\s*$/.test(text)
  ) {
    segments.pop()
  }
  if (segments.length === 0) return null

  return segments.map((segment) => {
    const leading = segment.text.length - segment.text.trimStart().length
    return {
      text: segment.text.trim(),
      pos: lineFrom + segment.from + leading
    }
  })
}

function tableAlignment(cells: TableCellData[]): Array<'left' | 'center' | 'right' | null> | null {
  const align: Array<'left' | 'center' | 'right' | null> = []
  for (const cell of cells) {
    const match = /^(:?)-+(:?)$/.exec(cell.text)
    if (!match) return null
    if (match[1] && match[2]) align.push('center')
    else if (match[2]) align.push('right')
    else if (match[1]) align.push('left')
    else align.push(null)
  }
  return align
}

/** Index of the last line belonging to the table starting at `start` (1-based). */
function findTableEnd(state: EditorState, start: number): number {
  const doc = state.doc
  let end = start + 1
  for (let j = start + 2; j <= doc.lines; j++) {
    const text = doc.line(j).text
    if (!text.trim()) break
    // A table ends at the first blank line or at the start of another block, even
    // if that line happens to contain a pipe (for example a `## a | b` heading).
    if (/^\s*(?:#{1,6}\s|>|`{3,}|~{3,}|[-*+]\s|\d+[.)]\s)/.test(text)) break
    if (!splitTableRow(text, doc.line(j).from)) break
    end = j
  }
  return end
}

function buildTableData(state: EditorState, start: number, end: number): TableData | null {
  const doc = state.doc
  const headerLine = doc.line(start)
  const header = splitTableRow(headerLine.text, headerLine.from)
  if (!header) return null

  const delimiterLine = doc.line(start + 1)
  const delimiter = splitTableRow(delimiterLine.text, delimiterLine.from)
  if (!delimiter || delimiter.length !== header.length) return null
  const align = tableAlignment(delimiter)
  if (!align) return null

  const rows: TableCellData[][] = []
  for (let j = start + 2; j <= end; j++) {
    const line = doc.line(j)
    const cells = splitTableRow(line.text, line.from)
    if (!cells) break
    rows.push(
      header.map((_, index) => cells[index] ?? { text: '', pos: -1 })
    )
  }

  return { header, align, rows, from: headerLine.from, to: doc.line(end).to }
}

/** Closing delimiter line of a YAML front matter block, or 0. */
function findFrontMatterEnd(state: EditorState): number {
  if (state.doc.line(1).text.trim() !== '---') return 0
  for (let j = 2; j <= state.doc.lines; j++) {
    if (state.doc.line(j).text.trim() === '---') return j
  }
  return 0
}

function cleanHeadingText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
    .trim()
}

/** All ATX headings outside fenced code blocks and YAML front matter. */
function collectHeadings(state: EditorState): TocHeading[] {
  const headings: TocHeading[] = []
  const frontMatterEnd = findFrontMatterEnd(state)
  let fenceChar = ''
  let fenceLength = 0

  for (let j = 1; j <= state.doc.lines; j++) {
    const line = state.doc.line(j)
    const text = line.text

    const fence = /^\s*(`{3,}|~{3,})/.exec(text)
    if (fence) {
      if (!fenceChar) {
        fenceChar = fence[1][0]
        fenceLength = fence[1].length
      } else if (fence[1][0] === fenceChar && fence[1].length >= fenceLength) {
        fenceChar = ''
        fenceLength = 0
      }
      continue
    }
    if (fenceChar) continue
    if (frontMatterEnd && j <= frontMatterEnd) continue

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(text)
    if (!match) continue
    const label = cleanHeadingText(match[2])
    if (!label) continue
    headings.push({ level: match[1].length, text: label, pos: line.from })
  }
  return headings
}

function buildDecorations(state: EditorState): DecorationSet {
  const doc = state.doc
  const cursorLine = doc.lineAt(state.selection.main.head).number
  const decos: Array<Range<Decoration>> = []
  const theme = themeName()
  const docPath = getPreviewDocPath()

  let i = 1
  // Tables are numbered by their order in the document; that index keys the stored
  // column widths, so it must not depend on line numbers (which shift on edits).
  let tableIndex = 0
  while (i <= doc.lines) {
    const line = doc.line(i)
    const text = line.text
    const active = line.number === cursorLine

    // YAML front matter: delimiters are hidden and the block gets a card style,
    // while the YAML itself stays editable. Placing the cursor inside reveals the
    // delimiters again.
    if (i === 1) {
      const end = findFrontMatterEnd(state)
      if (end) {
        const blockActive = cursorLine <= end
        for (let k = 1; k <= end; k++) {
          const classes = ['cm-md-frontmatter']
          if (k === 1) classes.push('cm-md-frontmatter-first')
          if (k === end) classes.push('cm-md-frontmatter-last')
          decos.push(Decoration.line({ class: classes.join(' ') }).range(doc.line(k).from))
        }
        if (!blockActive) {
          decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(line.from, line.to))
          const closing = doc.line(end)
          decos.push(
            Decoration.replace({ widget: new EmptyWidget() }).range(closing.from, closing.to)
          )
        } else {
          decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(line.from, line.to))
          const closing = doc.line(end)
          decos.push(
            Decoration.mark({ class: 'cm-md-syntax' }).range(closing.from, closing.to)
          )
        }
        i = end + 1
        continue
      }
    }

    // Footnote definition, e.g. `[^1]: The note text.`
    const footnoteDef = /^\[\^([^\]\s]+)\]:[ \t]*/.exec(text)
    if (footnoteDef) {
      const markerEnd = line.from + footnoteDef[0].length
      decos.push(Decoration.line({ class: 'cm-md-footnote-def' }).range(line.from))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(line.from, markerEnd))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(line.from, markerEnd))
      }
      processInline(decos, markerEnd, text.slice(footnoteDef[0].length), active, docPath)
      i++
      continue
    }

    // `[TOC]` expands into a clickable outline of the document headings.
    if (text.trim().toUpperCase() === '[TOC]') {
      if (active) {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(line.from, line.to))
      } else {
        decos.push(
          Decoration.replace({
            widget: new TocWidget(collectHeadings(state)),
            block: true
          }).range(line.from, line.to)
        )
      }
      i++
      continue
    }

    const fence = /^(\s*)(`{3,}|~{3,})\s*([^\s`]*)/.exec(text)
    if (fence) {
      const char = fence[2][0]
      const length = fence[2].length
      const closeLine = findClosingFence(state, i, char, length)
      const end = closeLine || doc.lines
      const blockActive = cursorLine >= i && cursorLine <= end
      const language = fence[3].toLowerCase()
      const codeLines: string[] = []
      for (let k = i + 1; k < end; k++) codeLines.push(doc.line(k).text)
      const code = codeLines.join('\n')

      const customRenderer = language ? codeRendererMap.get(language) : undefined
      const canRender = !blockActive && (language === 'mermaid' || Boolean(customRenderer))

      if (canRender) {
        const widget =
          language === 'mermaid'
            ? new MermaidWidget(code, theme)
            : new CustomCodeWidget(code, language)
        decos.push(
          Decoration.replace({ widget, block: true }).range(line.from, doc.line(end).to)
        )
        i = end + 1
        continue
      }

      for (let k = i; k <= end; k++) {
        const current = doc.line(k)
        const classes = ['cm-md-codeblock']
        if (k === i) classes.push('cm-md-codeblock-first')
        if (k === end) classes.push('cm-md-codeblock-last')
        decos.push(Decoration.line({ class: classes.join(' ') }).range(current.from))
      }

      if (!blockActive) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(line.from, line.to))
        if (closeLine) {
          const closing = doc.line(closeLine)
          decos.push(
            Decoration.replace({ widget: new EmptyWidget() }).range(closing.from, closing.to)
          )
        }
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(line.from, line.to))
        if (closeLine) {
          const closing = doc.line(closeLine)
          decos.push(
            Decoration.mark({ class: 'cm-md-syntax' }).range(closing.from, closing.to)
          )
        }
      }

      i = end + 1
      continue
    }

    // GFM table: a header row plus a delimiter row such as `| --- | :---: |`.
    if (text.includes('|')) {
      const headerCells = splitTableRow(text, line.from)
      const delimiterLine = i < doc.lines ? doc.line(i + 1) : null
      const delimiterCells = delimiterLine
        ? splitTableRow(delimiterLine.text, delimiterLine.from)
        : null
      if (
        headerCells &&
        delimiterCells &&
        delimiterCells.length === headerCells.length &&
        tableAlignment(delimiterCells)
      ) {
        const end = findTableEnd(state, i)
        const blockActive = cursorLine >= i && cursorLine <= end
        const data = blockActive ? null : buildTableData(state, i, end)

        if (data) {
          decos.push(
            Decoration.replace({
              widget: new TableWidget(data, tableIndex),
              block: true
            }).range(line.from, doc.line(end).to)
          )
          tableIndex += 1
          i = end + 1
          continue
        }

        for (let k = i; k <= end; k++) {
          decos.push(Decoration.line({ class: 'cm-md-table-source' }).range(doc.line(k).from))
        }
        i = end + 1
        continue
      }
    }

    if (/^\s*\$\$\s*$/.test(text)) {
      let closeLine = 0
      for (let j = i + 1; j <= doc.lines; j++) {
        if (/^\s*\$\$\s*$/.test(doc.line(j).text)) {
          closeLine = j
          break
        }
      }
      if (closeLine) {
        const blockActive = cursorLine >= i && cursorLine <= closeLine
        if (!blockActive) {
          const codeLines: string[] = []
          for (let k = i + 1; k < closeLine; k++) codeLines.push(doc.line(k).text)
          decos.push(
            Decoration.replace({
              widget: new MathWidget(codeLines.join('\n'), true),
              block: true
            }).range(line.from, doc.line(closeLine).to)
          )
          i = closeLine + 1
          continue
        }
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(line.from, line.to))
        i++
        continue
      }
    }

    const singleMath = /^\s*\$\$(.+?)\$\$\s*$/.exec(text)
    if (singleMath) {
      if (!active) {
        decos.push(
          Decoration.replace({
            widget: new MathWidget(singleMath[1].trim(), true),
            block: true
          }).range(line.from, line.to)
        )
        i++
        continue
      }
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(text)) {
      if (!active) {
        decos.push(
          Decoration.replace({ widget: new HrWidget(), block: true }).range(line.from, line.to)
        )
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(line.from, line.to))
      }
      i++
      continue
    }

    let contentFrom = line.from
    let headingMatch: RegExpExecArray | null = null
    let quoteMatch: RegExpExecArray | null = null
    let taskMatch: RegExpExecArray | null = null
    let listMatch: RegExpExecArray | null = null

    headingMatch = /^(#{1,6})(\s+)/.exec(text)
    if (!headingMatch) quoteMatch = /^(\s*(?:>\s?)+)/.exec(text)
    if (!headingMatch && !quoteMatch)
      taskMatch = /^(\s*)([-*+]|\d+\.)(\s+)\[([ xX])\](?=\s|$)/.exec(text)
    if (!headingMatch && !quoteMatch && !taskMatch)
      listMatch = /^(\s*)([-*+]|\d+\.)(\s+)/.exec(text)

    if (headingMatch) {
      const level = headingMatch[1].length
      decos.push(Decoration.line({ class: `cm-md-h${level}` }).range(line.from))
      const markerEnd = line.from + headingMatch[0].length
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(line.from, markerEnd))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(line.from, markerEnd))
      }
      contentFrom = markerEnd
    } else if (quoteMatch) {
      decos.push(Decoration.line({ class: 'cm-md-quote' }).range(line.from))
      const markerEnd = line.from + quoteMatch[0].length
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(line.from, markerEnd))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(line.from, markerEnd))
      }
      contentFrom = markerEnd
    } else if (taskMatch) {
      const markerStart = line.from + taskMatch[1].length
      const markerEnd = markerStart + taskMatch[2].length + taskMatch[3].length
      const bracketStart = markerEnd
      const bracketEnd = bracketStart + 3
      decos.push(Decoration.line({ class: 'cm-md-list' }).range(line.from))
      if (!active) {
        decos.push(
          Decoration.replace({
            widget: new BulletWidget(taskMatch[2] === '-' || taskMatch[2] === '*' || taskMatch[2] === '+' ? '•' : taskMatch[2])
          }).range(markerStart, markerEnd)
        )
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(markerStart, markerEnd))
      }
      const checked = taskMatch[4].toLowerCase() === 'x'
      decos.push(
        Decoration.replace({
          widget: new CheckboxWidget(checked, bracketStart)
        }).range(bracketStart, bracketEnd)
      )
      if (checked) {
        decos.push(Decoration.line({ class: 'cm-md-task-done' }).range(line.from))
      }
      contentFrom = bracketEnd
    } else if (listMatch) {
      const markerStart = line.from + listMatch[1].length
      const markerEnd = markerStart + listMatch[2].length + listMatch[3].length
      decos.push(Decoration.line({ class: 'cm-md-list' }).range(line.from))
      const ordered = /\d+\./.test(listMatch[2])
      if (!active) {
        decos.push(
          Decoration.replace({
            widget: new BulletWidget(ordered ? listMatch[2] : '•')
          }).range(markerStart, markerEnd)
        )
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(markerStart, markerEnd))
      }
      contentFrom = markerEnd
    }

    processInline(decos, contentFrom, text.slice(contentFrom - line.from), active, docPath)
    i++
  }

  return Decoration.set(decos, true)
}

function processInline(
  decos: Array<Range<Decoration>>,
  from: number,
  text: string,
  active: boolean,
  docPath: string | null
): void {
  let index = 0
  while (index < text.length) {
    const rest = text.slice(index)
    const start = from + index

    const code = /^(`+)([^`\n]+?)\1/.exec(rest)
    if (code) {
      const markerLength = code[1].length
      const contentStart = start + markerLength
      const contentEnd = contentStart + code[2].length
      const end = start + code[0].length
      decos.push(Decoration.mark({ class: 'cm-md-code' }).range(contentStart, contentEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, contentStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(contentEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, contentStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(contentEnd, end))
      }
      index += code[0].length
      continue
    }

    const math = /^\$([^$\n]+?)\$/.exec(rest)
    if (math) {
      const end = start + math[0].length
      if (!active) {
        decos.push(Decoration.replace({ widget: new MathWidget(math[1], false) }).range(start, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, end))
      }
      index += math[0].length
      continue
    }

    const footnoteRef = /^\[\^([^\]\n]+)\]/.exec(rest)
    if (footnoteRef) {
      const contentStart = start + 2
      const contentEnd = contentStart + footnoteRef[1].length
      const end = start + footnoteRef[0].length
      decos.push(Decoration.mark({ class: 'cm-md-footnote-ref' }).range(contentStart, contentEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, contentStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(contentEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, contentStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(contentEnd, end))
      }
      index += footnoteRef[0].length
      continue
    }

    const image = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*(=\s*\d*\s*x\s*\d*\s*)?\)/.exec(rest)
    if (image) {
      const end = start + image[0].length
      if (!active) {
        const parsed = parseImageToken(image[0])
        const src = parsed?.src ?? image[2]
        const alt = parsed?.alt ?? image[1]
        decos.push(
          Decoration.replace({
            widget: new ImageWidget(src, alt, docPath, parsed?.size ?? null)
          }).range(start, end)
        )
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, end))
      }
      index += image[0].length
      continue
    }

    const link = /^\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/.exec(rest)
    if (link) {
      const textStart = start + 1
      const textEnd = textStart + link[1].length
      const end = start + link[0].length
      decos.push(Decoration.mark({ class: 'cm-md-link' }).range(textStart, textEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, textStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(textEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, textStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(textEnd, end))
      }
      index += link[0].length
      continue
    }

    const strong = /^(\*\*|__)([^\n]+?)\1/.exec(rest)
    if (strong) {
      const markerLength = strong[1].length
      const contentStart = start + markerLength
      const contentEnd = contentStart + strong[2].length
      const end = start + strong[0].length
      decos.push(Decoration.mark({ class: 'cm-md-strong' }).range(contentStart, contentEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, contentStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(contentEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, contentStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(contentEnd, end))
      }
      index += strong[0].length
      continue
    }

    const strike = /^~~([^~\n]+?)~~/.exec(rest)
    if (strike) {
      const contentStart = start + 2
      const contentEnd = contentStart + strike[1].length
      const end = start + strike[0].length
      decos.push(Decoration.mark({ class: 'cm-md-strike' }).range(contentStart, contentEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, contentStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(contentEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, contentStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(contentEnd, end))
      }
      index += strike[0].length
      continue
    }

    const highlight = /^==([^=\n]+?)==/.exec(rest)
    if (highlight) {
      const contentStart = start + 2
      const contentEnd = contentStart + highlight[1].length
      const end = start + highlight[0].length
      decos.push(Decoration.mark({ class: 'cm-md-highlight' }).range(contentStart, contentEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, contentStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(contentEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, contentStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(contentEnd, end))
      }
      index += highlight[0].length
      continue
    }

    const sup = /^\^([^^\n]+?)\^/.exec(rest)
    if (sup) {
      const contentStart = start + 1
      const contentEnd = contentStart + sup[1].length
      const end = start + sup[0].length
      decos.push(Decoration.mark({ class: 'cm-md-sup' }).range(contentStart, contentEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, contentStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(contentEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, contentStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(contentEnd, end))
      }
      index += sup[0].length
      continue
    }

    const sub = /^~([^~\n]+?)~/.exec(rest)
    if (sub) {
      const contentStart = start + 1
      const contentEnd = contentStart + sub[1].length
      const end = start + sub[0].length
      decos.push(Decoration.mark({ class: 'cm-md-sub' }).range(contentStart, contentEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, contentStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(contentEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, contentStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(contentEnd, end))
      }
      index += sub[0].length
      continue
    }

    const em = /^(\*|_)([^*_\n]+?)\1/.exec(rest)
    if (em) {
      const contentStart = start + 1
      const contentEnd = contentStart + em[2].length
      const end = start + em[0].length
      decos.push(Decoration.mark({ class: 'cm-md-em' }).range(contentStart, contentEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, contentStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(contentEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, contentStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(contentEnd, end))
      }
      index += em[0].length
      continue
    }

    // Inline HTML used for underline, highlight, superscript and
    // subscript. The tags are hidden in preview mode and the content is styled.
    const htmlInline = /^<(u|mark|sup|sub)>([^<\n]+?)<\/\1>/.exec(rest)
    if (htmlInline) {
      const contentStart = start + htmlInline[1].length + 2
      const contentEnd = contentStart + htmlInline[2].length
      const end = start + htmlInline[0].length
      const cls = HTML_INLINE_CLASS[htmlInline[1]]
      decos.push(Decoration.mark({ class: cls }).range(contentStart, contentEnd))
      if (!active) {
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(start, contentStart))
        decos.push(Decoration.replace({ widget: new EmptyWidget() }).range(contentEnd, end))
      } else {
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(start, contentStart))
        decos.push(Decoration.mark({ class: 'cm-md-syntax' }).range(contentEnd, end))
      }
      index += htmlInline[0].length
      continue
    }

    index++
  }
}

/**
 * True while a rendered table cell is being edited. The check is derived from the
 * DOM instead of a module flag, so it can never get stuck if a blur is missed.
 */
function isEditingTableCell(): boolean {
  return document.activeElement?.classList.contains('cm-md-table-input') ?? false
}

export const livePreviewField = StateField.define<DecorationSet>({
  create: (state) => buildDecorations(state),
  update: (decorations, tr) => {
    const forced = tr.effects.some((effect) => effect.is(forcePreviewRebuild))
    if (forced) {
      return buildDecorations(tr.state)
    }
    // Keep the rendered table (and the focused cell) alive while a cell is edited.
    // The table is rebuilt once editing ends, when the caller forces a rebuild.
    if (isEditingTableCell()) {
      return decorations.map(tr.changes)
    }
    if (tr.docChanged || tr.selection !== undefined) {
      return buildDecorations(tr.state)
    }
    return decorations.map(tr.changes)
  },
  provide: (field) => EditorView.decorations.from(field)
})
