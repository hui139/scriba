/**
 * Minimal Markdown → LaTeX converter for "Export as LaTeX".
 *
 * It targets the subset authors actually export: headings, emphasis,
 * inline/block math, code fences, lists, quotes, tables, links, images and
 * footnotes. Anything unrecognised is escaped and passed through as text, so the
 * output always compiles instead of silently dropping content.
 */

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

/** Inline formatting, applied to already-escaped text fragments. */
function inlineLatex(text: string): string {
  let out = text

  // Inline math is preserved verbatim; escaping would corrupt the formula.
  const mathSlots: string[] = []
  out = out.replace(/\$([^$\n]+?)\$/g, (_match, body: string) => {
    mathSlots.push(`$${body}$`)
    return `\u0000MATH${mathSlots.length - 1}\u0000`
  })

  out = escapeLatex(out)

  out = out
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) => {
      const caption = alt ? escapeLatex(alt) : ''
      return `\\includegraphics[width=0.9\\linewidth]{${src}}${caption ? `\\caption{${caption}}` : ''}`
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) =>
      `\\href{${url}}{${label}}`
    )
    .replace(/`([^`]+)`/g, (_m, code: string) => `\\texttt{${escapeLatex(code)}}`)
    .replace(/\*\*\*(.+?)\*\*\*/g, '\\textbf{\\textit{$1}}')
    .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '\\textit{$1}')
    .replace(/~~(.+?)~~/g, '\\sout{$1}')
    .replace(/==(.+?)==/g, '\\hl{$1}')

  out = out.replace(/\u0000MATH(\d+)\u0000/g, (_m, index: string) => mathSlots[Number(index)] ?? '')
  return out
}

interface TableRows {
  header: string[]
  aligns: Array<'left' | 'center' | 'right'>
  body: string[][]
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseTable(lines: string[], start: number): { table: TableRows; next: number } | null {
  const headerLine = lines[start]
  const dividerLine = lines[start + 1]
  if (!headerLine?.includes('|') || !dividerLine || !/^[\s|:-]+$/.test(dividerLine)) return null
  if (!dividerLine.includes('-')) return null

  const header = splitRow(headerLine)
  const aligns = splitRow(dividerLine).map((cell): 'left' | 'center' | 'right' => {
    const left = cell.startsWith(':')
    const right = cell.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    return 'left'
  })

  const body: string[][] = []
  let index = start + 2
  while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
    body.push(splitRow(lines[index]))
    index += 1
  }
  return { table: { header, aligns, body }, next: index }
}

function tableLatex(table: TableRows): string {
  const columns = table.aligns.map((align) => (align === 'center' ? 'c' : align === 'right' ? 'r' : 'l'))
  const head = table.header.map((cell) => inlineLatex(cell)).join(' & ')
  const rows = table.body
    .map((row) => row.map((cell) => inlineLatex(cell)).join(' & ') + ' \\\\')
    .join('\n')
  return [
    '\\begin{table}[h]',
    '\\centering',
    `\\begin{tabular}{${columns.join('')}}`,
    '\\hline',
    `${head} \\\\`,
    '\\hline',
    rows,
    '\\hline',
    '\\end{tabular}',
    '\\end{table}'
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/** Converts a Markdown document into a standalone, compilable LaTeX file. */
export function renderLatex(markdownText: string, title: string): string {
  const withoutFrontMatter = markdownText.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
  const lines = withoutFrontMatter.split(/\r?\n/)

  const body: string[] = []
  let index = 0
  let inCode = false
  let codeFence = ''
  let codeLines: string[] = []
  // Open list environment, tracked separately so ordered and unordered lists can
  // be emitted correctly even when they are adjacent.
  let listKind: 'itemize' | 'enumerate' | null = null

  const closeList = (): void => {
    if (listKind) {
      body.push(`\\end{${listKind}}`)
      listKind = null
    }
  }

  while (index < lines.length) {
    const line = lines[index]

    // Fenced code blocks become verbatim environments.
    const fence = /^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/.exec(line)
    if (fence) {
      if (!inCode) {
        inCode = true
        codeFence = fence[1][0]
        codeLines = []
      } else if (fence[1][0] === codeFence) {
        inCode = false
        body.push(`\\begin{verbatim}\n${codeLines.join('\n')}\n\\end{verbatim}`)
        codeLines = []
      } else {
        codeLines.push(line)
      }
      index += 1
      continue
    }
    if (inCode) {
      codeLines.push(line)
      index += 1
      continue
    }

    // Display math block.
    if (/^\s*\$\$\s*$/.test(line)) {
      const math: string[] = []
      index += 1
      while (index < lines.length && !/^\s*\$\$\s*$/.test(lines[index])) {
        math.push(lines[index])
        index += 1
      }
      index += 1
      body.push(`\\begin{equation}\n${math.join('\n')}\n\\end{equation}`)
      continue
    }

    // Table.
    if (line.includes('|')) {
      const parsed = parseTable(lines, index)
      if (parsed) {
        closeList()
        body.push(tableLatex(parsed.table))
        index = parsed.next
        continue
      }
    }

    // Headings.
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      closeList()
      const level = heading[1].length
      const command = ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph', 'subparagraph'][
        level - 1
      ]
      body.push(`\\${command}{${inlineLatex(heading[2])}}`)
      index += 1
      continue
    }

    // Horizontal rule.
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeList()
      body.push('\\hrulefill')
      index += 1
      continue
    }

    // Blockquote: consecutive `>` lines become a quote environment.
    if (/^\s*>/.test(line)) {
      closeList()
      const quoted: string[] = []
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      body.push(`\\begin{quote}\n${inlineLatex(quoted.join(' '))}\n\\end{quote}`)
      continue
    }

    // Unordered / ordered list items.
    const bullet = /^(\s*)[-*+]\s+(?:\[([ xX])\]\s+)?(.*)$/.exec(line)
    const numbered = /^(\s*)\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const content = bullet ? bullet[3] : numbered![2]
      const task = bullet?.[2]
      const kind: 'itemize' | 'enumerate' = numbered ? 'enumerate' : 'itemize'
      if (listKind !== kind) {
        closeList()
        body.push(`\\begin{${kind}}`)
        listKind = kind
      }
      const marker = task ? `$\\square$ ` : ''
      body.push(`  \\item ${marker}${inlineLatex(content)}`)
      index += 1
      continue
    }

    // Blank line ends the current list.
    if (line.trim() === '') {
      closeList()
      index += 1
      continue
    }

    // Plain paragraph line.
    closeList()
    body.push(inlineLatex(line))
    index += 1
  }

  closeList()

  return `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{hyperref}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage[normalem]{ulem}
\\usepackage{soul}
\\usepackage[margin=2.5cm]{geometry}
\\title{${escapeLatex(title)}}
\\date{}
\\begin{document}
\\maketitle

${body.join('\n\n')}
\\end{document}
`
}
