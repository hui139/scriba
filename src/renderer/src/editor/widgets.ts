import { EditorView, WidgetType } from '@codemirror/view'
import katex from 'katex'
import { dirname, isAbsolute, joinPath, resolveAsset } from '../utils/path'
import { getPreviewDocPath } from './docPath'
import type { ImageSize } from '../markdown/imageSize'
import {
  clearColumnWidths,
  loadColumnWidths,
  resizeColumn,
  saveColumnWidths
} from './tableWidths'
import { codeRendererMap } from '../plugins/registry'
import { t } from '../i18n'
import { forcePreviewRebuild } from './editState'

export class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly block: boolean
  ) {
    super()
  }

  eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.block === this.block
  }

  toDOM(): HTMLElement {
    const el = document.createElement(this.block ? 'div' : 'span')
    el.className = this.block ? 'cm-md-math-block' : 'cm-md-math-inline'
    try {
      katex.render(this.tex, el, {
        displayMode: this.block,
        throwOnError: false,
        strict: 'ignore',
        trust: false
      })
    } catch {
      el.classList.add('cm-md-math-error')
      el.textContent = this.tex
    }
    return el
  }

  ignoreEvent(): boolean {
    return true
  }
}

export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly docPath: string | null,
    /** Size suffix: `=200x`, `=200x100` or `=x100`. */
    readonly size: ImageSize | null = null
  ) {
    super()
  }

  eq(other: ImageWidget): boolean {
    return (
      other.src === this.src &&
      other.alt === this.alt &&
      other.docPath === this.docPath &&
      other.size?.width === this.size?.width &&
      other.size?.height === this.size?.height
    )
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-md-image-widget'
    const img = document.createElement('img')
    img.alt = this.alt
    img.src = resolveAsset(this.src, this.docPath)
    img.loading = 'lazy'
    if (this.size?.width) img.width = this.size.width
    if (this.size?.height) img.height = this.size.height
    img.onerror = (): void => {
      wrapper.textContent = t('widget.image', { name: this.alt || this.src })
    }
    wrapper.appendChild(img)
    return wrapper
  }

  ignoreEvent(): boolean {
    return true
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number
  ) {
    super()
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.pos === this.pos
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'cm-md-checkbox'
    input.checked = this.checked
    input.addEventListener('change', () => {
      view.dispatch({
        changes: { from: this.pos, to: this.pos + 3, insert: input.checked ? '[x]' : '[ ]' }
      })
      view.focus()
    })
    return input
  }

  ignoreEvent(): boolean {
    return false
  }
}

export class BulletWidget extends WidgetType {
  constructor(readonly marker: string) {
    super()
  }

  eq(other: BulletWidget): boolean {
    return other.marker === this.marker
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-md-bullet'
    span.textContent = this.marker
    return span
  }

  ignoreEvent(): boolean {
    return true
  }
}

export class HrWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const hr = document.createElement('div')
    hr.className = 'cm-md-hr'
    return hr
  }

  ignoreEvent(): boolean {
    return true
  }
}

/** One cell of a rendered table, with the document offset of its text. */
export interface TableCellData {
  text: string
  pos: number
}

export interface TableData {
  header: TableCellData[]
  align: Array<'left' | 'center' | 'right' | null>
  rows: TableCellData[][]
  /** Document offsets of the whole table block. */
  from: number
  to: number
}

/**
 * Resolves a Markdown link target for the preview.
 *
 * Absolute URLs open in the browser through `setWindowOpenHandler`. Relative
 * links to other documents are routed through the `scriba-open:` scheme so the
 * main process can open them in the editor.
 */
function linkHref(href: string): string {
  if (/^(https?:|mailto:|tel:|data:|blob:|scriba-media:)/i.test(href)) return href
  if (href.startsWith('#')) return href

  const docPath = getPreviewDocPath()
  if (!docPath) return href

  const local = href.replace(/^file:\/\//i, '').split('#')[0]
  if (!local) return href

  const absolute = isAbsolute(local) ? local : joinPath(dirname(docPath), local)
  return `scriba-open://local/?p=${encodeURIComponent(absolute)}`
}

/** Minimal inline markdown for table cells (code, strong, em, strike, links). */
function appendInline(target: HTMLElement, text: string): void {
  let index = 0
  while (index < text.length) {
    const rest = text.slice(index)

    const code = /^(`+)([^`]+?)\1/.exec(rest)
    if (code) {
      const el = document.createElement('code')
      el.textContent = code[2]
      target.appendChild(el)
      index += code[0].length
      continue
    }

    const strong = /^(\*\*|__)(.+?)\1/.exec(rest)
    if (strong) {
      const el = document.createElement('strong')
      appendInline(el, strong[2])
      target.appendChild(el)
      index += strong[0].length
      continue
    }

    const strike = /^~~(.+?)~~/.exec(rest)
    if (strike) {
      const el = document.createElement('s')
      appendInline(el, strike[1])
      target.appendChild(el)
      index += strike[0].length
      continue
    }

    const highlight = /^==(.+?)==/.exec(rest)
    if (highlight) {
      const el = document.createElement('mark')
      el.className = 'cm-md-highlight'
      appendInline(el, highlight[1])
      target.appendChild(el)
      index += highlight[0].length
      continue
    }

    const sup = /^\^([^^]+?)\^/.exec(rest)
    if (sup) {
      const el = document.createElement('sup')
      appendInline(el, sup[1])
      target.appendChild(el)
      index += sup[0].length
      continue
    }

    const sub = /^~([^~]+?)~/.exec(rest)
    if (sub) {
      const el = document.createElement('sub')
      appendInline(el, sub[1])
      target.appendChild(el)
      index += sub[0].length
      continue
    }

    const htmlInline = /^<(u|mark|sup|sub)>([^<]+?)<\/\1>/.exec(rest)
    if (htmlInline) {
      const el = document.createElement(htmlInline[1])
      if (htmlInline[1] === 'u') el.className = 'cm-md-underline'
      if (htmlInline[1] === 'mark') el.className = 'cm-md-highlight'
      appendInline(el, htmlInline[2])
      target.appendChild(el)
      index += htmlInline[0].length
      continue
    }

    const em = /^(\*|_)([^*_]+?)\1/.exec(rest)
    if (em) {
      const el = document.createElement('em')
      appendInline(el, em[2])
      target.appendChild(el)
      index += em[0].length
      continue
    }

    const link = /^\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/.exec(rest)
    if (link) {
      const el = document.createElement('a')
      el.textContent = link[1]
      el.href = linkHref(link[2])
      el.target = '_blank'
      el.rel = 'noreferrer'
      target.appendChild(el)
      index += link[0].length
      continue
    }

    target.appendChild(document.createTextNode(rest[0]))
    index++
  }
}

function tableKey(data: TableData): string {
  return JSON.stringify(data)
}

const COLUMN_ADD_ICON =
  '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="1.5" y="2.5" width="9" height="11" rx="1.5"/>' +
  '<path d="M4.5 2.5v11M7.5 2.5v11"/>' +
  '<path d="M12.5 8h3M14 6.5v3"/></svg>'

const ROW_ADD_ICON =
  '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="2.5" y="1.5" width="11" height="9" rx="1.5"/>' +
  '<path d="M2.5 4.5h11M2.5 7.5h11"/>' +
  '<path d="M8 12.5v3M6.5 14h3"/></svg>'

/** A line ending in an unescaped pipe has a trailing delimiter. */
function endsWithTablePipe(text: string): boolean {
  return /\|\s*$/.test(text) && !/\\\|\s*$/.test(text)
}

function emptyCell(): TableCellData {
  return { text: '', pos: -1 }
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|')
}

function delimiterFor(align: TableData['align'][number]): string {
  if (align === 'left') return ':---'
  if (align === 'right') return '---:'
  if (align === 'center') return ':---:'
  return '---'
}

/** Serialize table data back to a GFM table block. */
function tableToMarkdown(data: TableData): string {
  const row = (cells: TableCellData[]): string =>
    `| ${data.header.map((_, index) => escapeCell(cells[index]?.text ?? '')).join(' | ')} |`
  return [
    row(data.header),
    `| ${data.align.map(delimiterFor).join(' | ')} |`,
    ...data.rows.map(row)
  ].join('\n')
}

function commitTable(view: EditorView, data: TableData, next: TableData): void {
  view.dispatch({
    changes: { from: data.from, to: data.to, insert: tableToMarkdown(next) }
  })
  view.focus()
}

function withColumn(
  data: TableData,
  index: number,
  mode: 'insert' | 'delete'
): TableData {
  const columnCount = data.header.length
  if (mode === 'delete' && columnCount <= 1) return data
  const at = Math.max(0, Math.min(index, columnCount))
  const header = [...data.header]
  const align = [...data.align]
  const rows = data.rows.map((row) => [...row])

  if (mode === 'insert') {
    header.splice(at, 0, emptyCell())
    align.splice(at, 0, null)
    rows.forEach((row) => row.splice(at, 0, emptyCell()))
  } else {
    header.splice(at, 1)
    align.splice(at, 1)
    rows.forEach((row) => row.splice(at, 1))
  }
  return { ...data, header, align, rows }
}

/** Change the alignment of one column (`null` restores the default). */
function withAlign(
  data: TableData,
  index: number,
  align: TableData['align'][number]
): TableData {
  if (index < 0 || index >= data.align.length) return data
  const next = [...data.align]
  if (next[index] === align) return data
  next[index] = align
  return { ...data, align: next }
}

function withRow(
  data: TableData,
  index: number,
  mode: 'above' | 'below' | 'delete'
): TableData {
  const rows = data.rows.map((row) => [...row])

  // `index === -1` means the header row. Deleting it promotes the first body row
  // to the header, so the first row is treated as the header.
  if (index === -1) {
    if (mode === 'delete') {
      if (rows.length === 0) return data
      return { ...data, header: rows[0], rows: rows.slice(1) }
    }
    rows.splice(0, 0, data.header.map(emptyCell))
    return { ...data, rows }
  }

  if (mode === 'delete') {
    if (index < 0 || index >= rows.length) return data
    rows.splice(index, 1)
  } else {
    const at = mode === 'above' ? index : index + 1
    rows.splice(at, 0, data.header.map(emptyCell))
  }
  return { ...data, rows }
}

function openTableMenu(
  event: MouseEvent,
  view: EditorView,
  data: TableData,
  rowIndex: number,
  colIndex: number
): void {
  document.querySelector('.cm-md-table-menu')?.remove()

  const menu = document.createElement('div')
  menu.className = 'cm-md-table-menu'
  menu.setAttribute('role', 'menu')

  const item = (label: string, action: () => void, disabled = false): void => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-md-table-menu-item'
    button.textContent = label
    button.disabled = disabled
    button.addEventListener('mousedown', (e) => e.preventDefault())
    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      close()
      action()
    })
    menu.appendChild(button)
  }

  item(t('table.insertRowAbove'), () =>
    commitTable(view, data, withRow(data, rowIndex, 'above'))
  )
  item(t('table.insertRowBelow'), () =>
    commitTable(view, data, withRow(data, rowIndex, 'below'))
  )
  item(
    t('table.deleteRow'),
    () => commitTable(view, data, withRow(data, rowIndex, 'delete')),
    rowIndex === -1 && data.rows.length === 0
  )

  const divider = document.createElement('div')
  divider.className = 'cm-md-table-menu-divider'
  menu.appendChild(divider)

  item(t('table.insertColumnLeft'), () =>
    commitTable(view, data, withColumn(data, colIndex, 'insert'))
  )
  item(t('table.insertColumnRight'), () =>
    commitTable(view, data, withColumn(data, colIndex + 1, 'insert'))
  )
  item(
    t('table.deleteColumn'),
    () => commitTable(view, data, withColumn(data, colIndex, 'delete')),
    data.header.length <= 1
  )

  const alignDivider = document.createElement('div')
  alignDivider.className = 'cm-md-table-menu-divider'
  menu.appendChild(alignDivider)

  const currentAlign = data.align[colIndex] ?? null
  const alignItem = (
    labelKey: string,
    align: TableData['align'][number]
  ): void => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-md-table-menu-item'
    button.textContent = t(labelKey)
    if (currentAlign === align) button.classList.add('active')
    button.addEventListener('mousedown', (e) => e.preventDefault())
    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      close()
      commitTable(view, data, withAlign(data, colIndex, align))
    })
    menu.appendChild(button)
  }

  alignItem('table.alignLeft', 'left')
  alignItem('table.alignCenter', 'center')
  alignItem('table.alignRight', 'right')
  alignItem('table.alignDefault', null)

  menu.style.left = `${event.clientX}px`
  menu.style.top = `${event.clientY}px`
  document.body.appendChild(menu)

  const rect = menu.getBoundingClientRect()
  if (rect.right > window.innerWidth - 8) {
    menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`
  }
  if (rect.bottom > window.innerHeight - 8) {
    menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`
  }

  function close(): void {
    menu.remove()
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeyDown, true)
  }

  function onPointerDown(e: PointerEvent): void {
    if (!menu.contains(e.target as Node)) close()
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)
}

/** Append one empty cell to every line of the table (one new column). */
function addTableColumn(view: EditorView, data: TableData): void {
  const doc = view.state.doc
  const first = doc.lineAt(data.from).number
  const last = doc.lineAt(data.to).number
  const changes: Array<{ from: number; insert: string }> = []

  for (let number = first; number <= last; number++) {
    const line = doc.line(number)
    const delimiter = number === first + 1
    const trailing = endsWithTablePipe(line.text)
    const insert = delimiter
      ? trailing
        ? ' --- |'
        : ' | --- |'
      : trailing
        ? '  |'
        : ' | |'
    changes.push({ from: line.to, insert })
  }

  view.dispatch({ changes })
}

/** Append one empty row below the table. */
function addTableRow(view: EditorView, data: TableData): void {
  const insert = `\n|${'  |'.repeat(data.header.length)}`
  view.dispatch({ changes: { from: data.to, insert } })
}

function toolButton(
  icon: string,
  label: string,
  action: () => void
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'cm-md-table-tool'
  button.title = label
  button.setAttribute('aria-label', label)
  button.innerHTML = icon
  button.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    action()
  })
  return button
}


/**
 * Put one cell into inline edit mode without unlinking the rendered table.
 *
 * The document is updated on every keystroke, but the live preview keeps the
 * current widget alive while a cell input has focus, so the input keeps focus
 * and the surrounding table stays visible.
 */
function beginCellEdit(view: EditorView, cellEl: HTMLElement, cell: TableCellData): void {
  if (cell.pos < 0) return

  const existing = cellEl.querySelector<HTMLInputElement>('.cm-md-table-input')
  if (existing) {
    existing.focus()
    existing.setSelectionRange(existing.value.length, existing.value.length)
    return
  }

  const input = document.createElement('input')
  input.className = 'cm-md-table-input'
  input.type = 'text'
  input.spellcheck = false
  input.value = cell.text

  const wrapper = cellEl.closest('.cm-md-table-widget')
  wrapper?.classList.add('is-editing')

  const from = cell.pos
  let to = cell.pos + cell.text.length
  const original = cell.text
  let value = cell.text

  cellEl.textContent = ''
  cellEl.appendChild(input)
  input.focus()
  input.setSelectionRange(value.length, value.length)

  const sync = (): void => {
    if (input.value === value) return
    value = input.value
    view.dispatch({ changes: { from, to, insert: value } })
    to = from + value.length
  }

  input.addEventListener('input', sync)
  input.addEventListener('mousedown', (event) => event.stopPropagation())
  input.addEventListener('click', (event) => event.stopPropagation())
  input.addEventListener('keydown', (event) => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      // Cancel: put the cell's original markdown back.
      if (value !== original) {
        value = original
        view.dispatch({ changes: { from, to, insert: value } })
        to = from + value.length
      }
      input.blur()
      view.focus()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      sync()
      input.blur()
      view.focus()
    }
  })
  input.addEventListener('blur', () => {
    wrapper?.classList.remove('is-editing')
    cellEl.textContent = ''
    appendInline(cellEl, value)
  })
}

export class TableWidget extends WidgetType {
  constructor(
    readonly data: TableData,
    /** Position of this table within the document, used to key stored widths. */
    readonly tableIndex = 0
  ) {
    super()
  }

  eq(other: TableWidget): boolean {
    return other.tableIndex === this.tableIndex && tableKey(other.data) === tableKey(this.data)
  }

  private makeCell(
    view: EditorView,
    tag: 'th' | 'td',
    cell: TableCellData | undefined,
    align: TableData['align'][number]
  ): HTMLElement {
    const el = document.createElement(tag)
    if (align) el.style.textAlign = align
    if (!cell) return el

    el.dataset.pos = String(cell.pos)
    appendInline(el, cell.text)

    if (cell.pos >= 0) {
      el.classList.add('cm-md-table-cell')
      el.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation()
        // Ctrl/Cmd+click is the escape hatch to the raw markdown block.
        if (event.ctrlKey || event.metaKey) {
          view.dispatch({ selection: { anchor: cell.pos }, scrollIntoView: true })
          view.focus()
          return
        }
        beginCellEdit(view, el, cell)
      })
    }

    return el
  }

  /**
   * Applies stored column widths to a freshly rendered table and installs the
   * drag handles that change them.
   *
   * Widths are fractions of the table width, written to a `<colgroup>` so every
   * row stays aligned without touching individual cells.
   */
  private applyColumnWidths(view: EditorView, table: HTMLTableElement): void {
    const docPath = getPreviewDocPath()
    const columnCount = this.data.header.length
    if (columnCount === 0) return

    let widths = loadColumnWidths(docPath, this.tableIndex)
    if (widths && widths.length !== columnCount) widths = null

    const colgroup = document.createElement('colgroup')
    const cols: HTMLTableColElement[] = []
    for (let i = 0; i < columnCount; i++) {
      const col = document.createElement('col')
      if (widths) col.style.width = `${(widths[i] * 100).toFixed(3)}%`
      colgroup.appendChild(col)
      cols.push(col)
    }
    table.insertBefore(colgroup, table.firstChild)

    const headRow = table.querySelector('thead tr')
    if (!headRow) return

    const write = (next: number[]): void => {
      next.forEach((fraction, index) => {
        const col = cols[index]
        if (col) col.style.width = `${(fraction * 100).toFixed(3)}%`
      })
      saveColumnWidths(docPath, this.tableIndex, next)
    }

    const currentFractions = (): number[] => {
      const total = table.getBoundingClientRect().width || 1
      const cells = Array.from(headRow.children) as HTMLElement[]
      const measured = cells.map((cell) => cell.getBoundingClientRect().width / total)
      const sum = measured.reduce((a, b) => a + b, 0)
      return sum > 0 ? measured.map((width) => width / sum) : measured
    }

    for (let i = 0; i < columnCount; i++) {
      const cell = headRow.children[i] as HTMLElement | undefined
      if (!cell) continue

      const handle = document.createElement('span')
      handle.className = 'cm-md-table-col-resize'
      handle.setAttribute('role', 'separator')
      handle.setAttribute('aria-orientation', 'vertical')
      handle.setAttribute('aria-label', t('table.resizeColumn'))
      handle.title = t('table.resizeColumn')

      handle.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const startX = event.clientX
        const tableWidth = table.getBoundingClientRect().width || 1
        // Start from the stored fractions when present, otherwise measure the
        // natural layout once so the first drag is not a jump.
        const startWidths = widths ? [...widths] : currentFractions()
        widths = startWidths

        const onMove = (moveEvent: MouseEvent): void => {
          const deltaFraction = (moveEvent.clientX - startX) / tableWidth
          write(resizeColumn(startWidths, i, deltaFraction))
        }
        const onUp = (): void => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          document.body.classList.remove('cm-resizing-table')
          view.dispatch({ effects: forcePreviewRebuild.of(null) })
        }

        document.body.classList.add('cm-resizing-table')
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      })

      // Double-click resets the column layout back to automatic sizing.
      handle.addEventListener('dblclick', (event) => {
        event.preventDefault()
        event.stopPropagation()
        clearColumnWidths(docPath, this.tableIndex)
        cols.forEach((col) => {
          col.style.width = ''
        })
        widths = null
        view.dispatch({ effects: forcePreviewRebuild.of(null) })
      })

      cell.appendChild(handle)
    }
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-md-table-widget'

    const scroll = document.createElement('div')
    scroll.className = 'cm-md-table-scroll'

    const table = document.createElement('table')
    table.className = 'cm-md-table'

    const head = document.createElement('thead')
    const headRow = document.createElement('tr')
    this.data.header.forEach((cell, index) => {
      headRow.appendChild(this.makeCell(view, 'th', cell, this.data.align[index] ?? null))
    })
    head.appendChild(headRow)
    table.appendChild(head)

    if (this.data.rows.length > 0) {
      const body = document.createElement('tbody')
      for (const row of this.data.rows) {
        const tr = document.createElement('tr')
        this.data.header.forEach((_header, index) => {
          tr.appendChild(this.makeCell(view, 'td', row[index], this.data.align[index] ?? null))
        })
        body.appendChild(tr)
      }
      table.appendChild(body)
    }

    scroll.appendChild(table)

    // Column widths are app metadata (GFM has no syntax for them), so they are
    // applied on top of the rendered table rather than written into the document.
    this.applyColumnWidths(view, table)

    // Right-click a cell for row/column operations.
    table.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (wrapper.classList.contains('is-editing')) return
      const target = event.target as HTMLElement
      const cell = target.closest('th, td')
      if (!cell) return
      const row = cell.closest('tr')
      if (!row) return
      const colIndex = Array.from(row.children).indexOf(cell)
      const body = row.closest('tbody')
      const rowIndex = body ? Array.from(body.children).indexOf(row) : -1
      openTableMenu(event, view, this.data, rowIndex, colIndex)
    })

    // Row/column controls live beside the table so the rendered block stays a
    // visual table instead of dropping back to raw markdown.
    const tools = document.createElement('div')
    tools.className = 'cm-md-table-tools'
    tools.setAttribute('role', 'toolbar')
    tools.setAttribute('aria-label', t('table.tools'))
    tools.append(
      toolButton(COLUMN_ADD_ICON, t('table.addColumn'), () => addTableColumn(view, this.data)),
      toolButton(ROW_ADD_ICON, t('table.addRow'), () => addTableRow(view, this.data))
    )

    wrapper.append(scroll, tools)

    // Once focus leaves the whole table, the edit session is over and the table is
    // re-rendered from the updated markdown.
    wrapper.addEventListener('focusout', (event) => {
      const next = event.relatedTarget as Node | null
      if (next && wrapper.contains(next)) return
      if (!wrapper.isConnected) return
      view.dispatch({ effects: forcePreviewRebuild.of(null) })
    })

    return wrapper
  }

  ignoreEvent(): boolean {
    return true
  }
}

export interface TocHeading {
  level: number
  text: string
  pos: number
}

/**
 * `[TOC]` block: a clickable list generated from the document headings. Keeping
 * it as a widget means it updates as soon as a heading changes.
 */
export class TocWidget extends WidgetType {
  constructor(readonly headings: TocHeading[]) {
    super()
  }

  eq(other: TocWidget): boolean {
    return JSON.stringify(other.headings) === JSON.stringify(this.headings)
  }

  toDOM(view: EditorView): HTMLElement {
    const nav = document.createElement('nav')
    nav.className = 'cm-md-toc'

    const title = document.createElement('div')
    title.className = 'cm-md-toc-title'
    title.textContent = t('toc.title')
    nav.appendChild(title)

    if (this.headings.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'cm-md-toc-empty'
      empty.textContent = t('toc.empty')
      nav.appendChild(empty)
      return nav
    }

    const list = document.createElement('div')
    list.className = 'cm-md-toc-list'
    for (const heading of this.headings) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'cm-md-toc-item'
      item.style.paddingLeft = `${8 + (heading.level - 1) * 14}px`
      item.textContent = heading.text || t('toc.untitled')
      item.addEventListener('mousedown', (event) => event.preventDefault())
      item.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        view.dispatch({
          selection: { anchor: heading.pos },
          effects: EditorView.scrollIntoView(heading.pos, { y: 'start' })
        })
        view.focus()
      })
      list.appendChild(item)
    }
    nav.appendChild(list)
    return nav
  }

  ignoreEvent(): boolean {
    return false
  }
}

export class EmptyWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.textContent = ''
    return span
  }
}

let mermaidInitializedFor: string | null = null

async function getMermaid(theme: string): Promise<typeof import('mermaid').default> {
  const mod = await import('mermaid')
  const mermaid = mod.default
  const mermaidTheme = /dark|nord|solarized-dark/i.test(theme) ? 'dark' : 'default'
  if (mermaidInitializedFor !== mermaidTheme) {
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'strict',
      fontFamily: 'var(--font-ui)'
    })
    mermaidInitializedFor = mermaidTheme
  }
  return mermaid
}

let diagramId = 0

export class MermaidWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly theme: string
  ) {
    super()
  }

  eq(other: MermaidWidget): boolean {
    return other.code === this.code && other.theme === this.theme
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-md-mermaid'
    el.textContent = t('widget.renderingDiagram')
    void renderMermaid(this.code, this.theme, el)
    return el
  }

  ignoreEvent(): boolean {
    return true
  }
}

async function renderMermaid(code: string, theme: string, el: HTMLElement): Promise<void> {
  try {
    const mermaid = await getMermaid(theme)
    const id = `scriba-mermaid-${++diagramId}`
    const { svg } = await mermaid.render(id, code)
    el.innerHTML = svg
  } catch (error) {
    el.classList.add('cm-md-mermaid-error')
    el.textContent = t('widget.mermaidError', {
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

export class CustomCodeWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly language: string
  ) {
    super()
  }

  eq(other: CustomCodeWidget): boolean {
    return other.code === this.code && other.language === this.language
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-md-mermaid'
    const renderer = codeRendererMap.get(this.language.toLowerCase())
    if (renderer) {
      try {
        void renderer(this.code, el)
      } catch (error) {
        el.textContent = String(error)
      }
    } else {
      el.textContent = this.code
    }
    return el
  }

  ignoreEvent(): boolean {
    return true
  }
}
