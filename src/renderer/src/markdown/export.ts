import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import themesCss from '../styles/themes.css?raw'
import { t } from '../i18n'
import { parseImageToken, sizeAttributes } from './imageSize'

marked.use({
  gfm: true,
  breaks: false,
  extensions: [
    {
      name: 'mathBlock',
      level: 'block',
      start(src: string) {
        return src.indexOf('$$')
      },
      tokenizer(src: string) {
        const match = /^\$\$([\s\S]+?)\$\$(?:\n|$)/.exec(src)
        if (match) return { type: 'mathBlock', raw: match[0], text: match[1].trim() }
        return undefined
      },
      renderer(token: any) {
        return `<div class="math-block">${katex.renderToString(token.text, {
          displayMode: true,
          throwOnError: false,
          output: 'mathml'
        })}</div>`
      }
    },
    {
      name: 'mathInline',
      level: 'inline',
      start(src: string) {
        return src.indexOf('$')
      },
      tokenizer(src: string) {
        const match = /^\$([^$\n]+?)\$/.exec(src)
        if (match) return { type: 'mathInline', raw: match[0], text: match[1] }
        return undefined
      },
      renderer(token: any) {
        return katex.renderToString(token.text, { displayMode: false, throwOnError: false, output: 'mathml' })
      }
    },
    {
      name: 'highlight',
      level: 'inline',
      start(src: string) {
        return src.indexOf('==')
      },
      tokenizer(src: string) {
        const match = /^==([^=\n]+?)==/.exec(src)
        if (match) return { type: 'highlight', raw: match[0], text: match[1] }
        return undefined
      },
      renderer(token: any) {
        return `<mark>${escapeHtml(token.text)}</mark>`
      }
    },
    {
      name: 'superscript',
      level: 'inline',
      start(src: string) {
        return src.indexOf('^')
      },
      tokenizer(src: string) {
        const match = /^\^([^^\n]+?)\^/.exec(src)
        if (match) return { type: 'superscript', raw: match[0], text: match[1] }
        return undefined
      },
      renderer(token: any) {
        return `<sup>${escapeHtml(token.text)}</sup>`
      }
    },
    {
      name: 'subscript',
      level: 'inline',
      start(src: string) {
        return src.indexOf('~')
      },
      tokenizer(src: string) {
        const match = /^~([^~\n]+?)~/.exec(src)
        if (match) return { type: 'subscript', raw: match[0], text: match[1] }
        return undefined
      },
      renderer(token: any) {
        return `<sub>${escapeHtml(token.text)}</sub>`
      }
    },
    {
      // The `![alt](pic.png =200x150)` size syntax. marked's built-in image
      // tokenizer stops at the space, so this extension claims the whole construct.
      name: 'sizedImage',
      level: 'inline',
      start(src: string) {
        return src.indexOf('![')
      },
      tokenizer(src: string) {
        const match = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*(=\s*\d*\s*x\s*\d*\s*)?\)/.exec(
          src
        )
        if (!match) return undefined
        const parsed = parseImageToken(match[0])
        if (!parsed || !parsed.size) return undefined
        return { type: 'sizedImage', raw: match[0], parsed }
      },
      renderer(token: any) {
        const { alt, src, title, size } = token.parsed
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr}${sizeAttributes(size)}>`
      }
    }
  ]
})

const EXPORT_CSS = `
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.75;
}
.scriba-export {
  max-width: 820px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}
.scriba-export h1, .scriba-export h2, .scriba-export h3,
.scriba-export h4, .scriba-export h5, .scriba-export h6 {
  line-height: 1.35;
  margin: 1.4em 0 0.5em;
  color: var(--text);
}
.scriba-export h1 { font-size: 2em; }
.scriba-export h2 { font-size: 1.55em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.scriba-export h3 { font-size: 1.3em; }
.scriba-export h4 { font-size: 1.12em; }
.scriba-export h5 { font-size: 1em; }
.scriba-export h6 { font-size: 0.92em; color: var(--text-secondary); }
.scriba-export p { margin: 0.85em 0; }
.scriba-export a { color: var(--accent); text-decoration: none; }
.scriba-export a:hover { text-decoration: underline; }
.scriba-export strong { font-weight: 700; }
.scriba-export mark {
  background: rgba(255, 214, 0, 0.35);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}
.scriba-export sup, .scriba-export sub { font-size: 0.75em; line-height: 0; }
.scriba-export u { text-underline-offset: 2px; }
.scriba-export blockquote {
  margin: 1em 0;
  padding: 0.2em 1em;
  border-left: 3px solid var(--quote-border);
  color: var(--text-secondary);
}
.scriba-export code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: var(--code-bg);
  color: var(--code-text);
  border-radius: 4px;
  padding: 0.15em 0.4em;
}
.scriba-export pre {
  background: var(--code-bg);
  border-radius: 8px;
  padding: 14px 16px;
  overflow-x: auto;
  line-height: 1.55;
}
.scriba-export pre code { background: none; color: var(--text); padding: 0; font-size: 0.86em; }
.scriba-export ul, .scriba-export ol { padding-left: 1.6em; }
.scriba-export li { margin: 0.25em 0; }
.scriba-export hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
.scriba-export table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: 0.95em; }
.scriba-export th, .scriba-export td { border: 1px solid var(--border); padding: 8px 12px; }
.scriba-export th { background: var(--bg-sidebar); font-weight: 600; }
.scriba-export img { max-width: 100%; border-radius: 6px; }
.scriba-export .toc {
  margin: 1.4em 0;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-sidebar);
}
.scriba-export .toc-title {
  margin-bottom: 8px;
  color: var(--text-muted);
  font-size: 0.78em;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.scriba-export .toc ul { margin: 0; padding: 0; list-style: none; }
.scriba-export .toc li { margin: 0.15em 0; }
.scriba-export .toc a { color: var(--text); }
.scriba-export .toc a:hover { color: var(--accent); }
.scriba-export .toc-level-2 { padding-left: 1em; }
.scriba-export .toc-level-3 { padding-left: 2em; }
.scriba-export .toc-level-4 { padding-left: 3em; }
.scriba-export .toc-level-5 { padding-left: 4em; }
.scriba-export .toc-level-6 { padding-left: 5em; }
.scriba-export .footnotes {
  margin-top: 2.5em;
  border-top: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 0.9em;
}
.scriba-export .footnotes hr { display: none; }
.scriba-export .footnotes ol { padding-left: 1.6em; }
.scriba-export .footnote-ref { font-size: 0.75em; vertical-align: super; line-height: 0; }
.scriba-export .footnote-ref a { text-decoration: none; }
.scriba-export .math-block { text-align: center; overflow-x: auto; padding: 8px 0; }
.scriba-export .mermaid-export { text-align: center; margin: 1.2em 0; overflow-x: auto; }
.scriba-export .mermaid-export svg { max-width: 100%; height: auto; }
.scriba-export .task-list-item { list-style: none; }
@media print {
  .scriba-export { padding: 0; max-width: none; }
  body { background: #fff; }
}
`

function decodeHtml(html: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = html
  return textarea.value
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** YAML front matter is metadata, not document content. */
function stripFrontMatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
}

interface FootnoteDef {
  id: string
  text: string
}

function footnoteAnchor(id: string): string {
  return id.replace(/[^\w\u4e00-\u9fff-]/g, '_')
}

/**
 * Pull `[^id]: text` definitions out of the document and turn inline `[^id]`
 * references into numbered superscript links.
 */
function extractFootnotes(
  markdown: string,
  defs: FootnoteDef[],
  order: string[]
): string {
  const lines = markdown.split(/\r?\n/)
  const body: string[] = []
  let fenceChar = ''

  // Pass 1: remove definition lines (but never inside fenced code).
  for (const line of lines) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (!fenceChar) fenceChar = fence[1][0]
      else if (fence[1][0] === fenceChar) fenceChar = ''
      body.push(line)
      continue
    }
    if (fenceChar) {
      body.push(line)
      continue
    }
    const def = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/.exec(line)
    if (def) {
      defs.push({ id: def[1], text: def[2] })
      body.push('')
      continue
    }
    body.push(line)
  }

  // Pass 2: link inline references, skipping fenced code.
  const byId = new Map(defs.map((def) => [def.id, def.text]))
  const numbers = new Map<string, number>()
  fenceChar = ''

  return body
    .map((line) => {
      const fence = /^\s*(`{3,}|~{3,})/.exec(line)
      if (fence) {
        if (!fenceChar) fenceChar = fence[1][0]
        else if (fence[1][0] === fenceChar) fenceChar = ''
        return line
      }
      if (fenceChar) return line

      return line.replace(/\[\^([^\]\s]+)\]/g, (raw, id: string) => {
        if (!byId.has(id)) return raw
        if (!numbers.has(id)) {
          numbers.set(id, numbers.size + 1)
          order.push(id)
        }
        const safe = footnoteAnchor(id)
        return `<sup class="footnote-ref" id="fnref-${safe}"><a href="#fn-${safe}">${numbers.get(id)}</a></sup>`
      })
    })
    .join('\n')
}

function footnotesHtml(defs: FootnoteDef[], order: string[]): string {
  if (order.length === 0) return ''
  const byId = new Map(defs.map((def) => [def.id, def.text]))
  const items = order.map((id) => {
    const safe = footnoteAnchor(id)
    const body = marked.parseInline(byId.get(id) ?? '', { async: false }) as string
    return `<li id="fn-${safe}">${body} <a class="footnote-backref" href="#fnref-${safe}">↩</a></li>`
  })
  return `<section class="footnotes"><hr><ol>${items.join('')}</ol></section>`
}

interface TocItem {
  level: number
  text: string
}

/** Headings used by `[TOC]`, matching the order marked emits `<hN>` tags. */
function collectToc(markdown: string): TocItem[] {
  const items: TocItem[] = []
  let fenceChar = ''
  let fenceLength = 0

  for (const line of markdown.split(/\r?\n/)) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)
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

    const match = /^\s*(?:>\s*)*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue
    const text = match[2]
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*_~]/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (text) items.push({ level: match[1].length, text })
  }
  return items
}

function tocHtml(items: TocItem[]): string {
  const entries = items
    .map(
      (item, index) =>
        `<li class="toc-level-${item.level}"><a href="#toc-${index}">${escapeHtml(item.text)}</a></li>`
    )
    .join('')
  return `<nav class="toc"><div class="toc-title">${escapeHtml(t('toc.title'))}</div><ul>${entries}</ul></nav>`
}

export interface ExportRenderOptions {
  /** Path of the source document, used to resolve relative image links. */
  docPath?: string | null
  /** Extra CSS from `<userData>/export-templates/*.css`, applied after the built-ins. */
  templateCss?: string | null
}

export async function renderDocumentHtml(
  markdownText: string,
  title: string,
  theme: string,
  options: ExportRenderOptions = {}
): Promise<string> {
  const docPath = options.docPath ?? null
  let markdown = stripFrontMatter(markdownText)

  const footnoteDefs: FootnoteDef[] = []
  const footnoteOrder: string[] = []
  markdown = extractFootnotes(markdown, footnoteDefs, footnoteOrder)

  const tocItems = collectToc(markdown)
  const hasToc = /^\[TOC\][ \t]*$/im.test(markdown)
  if (hasToc) markdown = markdown.replace(/^\[TOC\][ \t]*$/gim, 'SCRIBA_TOC_PLACEHOLDER')

  let html = marked.parse(markdown, { async: false }) as string

  const mermaidBlocks: Array<{ id: string; code: string }> = []
  html = html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_match, code: string) => {
      const id = `mermaid-export-${mermaidBlocks.length}`
      mermaidBlocks.push({ id, code: decodeHtml(code) })
      return `<div class="mermaid-placeholder" data-id="${id}"></div>`
    }
  )

  if (mermaidBlocks.length > 0) {
    try {
      const mermaid = (await import('mermaid')).default
      const isDark = /dark|nord|solarized-dark/i.test(theme)
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'strict'
      })
      for (const block of mermaidBlocks) {
        try {
          const { svg } = await mermaid.render(block.id, block.code)
          html = html.replace(
            `<div class="mermaid-placeholder" data-id="${block.id}"></div>`,
            `<div class="mermaid-export">${svg}</div>`
          )
        } catch {
          html = html.replace(
            `<div class="mermaid-placeholder" data-id="${block.id}"></div>`,
            `<pre><code>${escapeHtml(block.code)}</code></pre>`
          )
        }
      }
    } catch {
      // mermaid failed to load; leave placeholders empty
    }
  }

  // Number headings so `[TOC]` links have stable anchors.
  let headingIndex = 0
  html = html.replace(
    /<h([1-6])>/g,
    (_match, level: string) => `<h${level} id="toc-${headingIndex++}">`
  )
  if (hasToc) {
    html = html.replace(/<p>\s*SCRIBA_TOC_PLACEHOLDER\s*<\/p>/g, tocHtml(tocItems))
  }
  html += footnotesHtml(footnoteDefs, footnoteOrder)

  // Exported files live outside the workspace, so relative image links have to be
  // inlined before the HTML is written, otherwise they show as broken images.
  html = await inlineImages(html, docPath)

  const safe = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true }
  })

  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(theme)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${themesCss}</style>
<style>${EXPORT_CSS}</style>
${options.templateCss ? `<style>/* user export template */\n${options.templateCss}</style>` : ''}
</head>
<body>
<article class="scriba-export">${safe}</article>
</body>
</html>`
}

/**
 * Renders the document body for EPUB: XHTML-safe markup plus the CSS to embed.
 *
 * EPUB content documents must be well-formed XHTML, so void elements are closed
 * and the `<article>` wrapper is dropped in favour of a `<div>`. Images keep their
 * original relative paths; the EPUB writer rewrites them to archive entries.
 */
export async function renderEpubContent(
  markdownText: string,
  title: string,
  theme: string,
  options: ExportRenderOptions = {}
): Promise<{ title: string; xhtml: string; css: string }> {
  const page = await renderDocumentHtml(markdownText, title, theme, options)
  const marker = '<article class="scriba-export">'
  const start = page.indexOf(marker)
  const end = page.lastIndexOf('</article>')
  let body = start >= 0 && end > start ? page.slice(start + marker.length, end) : page

  // Make the fragment XHTML-valid: self-close void tags and swap the wrapper.
  body = body
    .replace(/<br\s*>/gi, '<br />')
    .replace(/<hr\s*>/gi, '<hr />')
    .replace(/<img\b([^>]*?)(?<!\/)>/gi, '<img$1 />')
    .replace(/<meta\b([^>]*?)(?<!\/)>/gi, '<meta$1 />')
    .replace(/<input\b([^>]*?)(?<!\/)>/gi, '<input$1 />')
    .replace(/&nbsp;/g, '&#160;')

  const css = `${EXPORT_CSS}\n${options.templateCss ?? ''}`

  return {
    title,
    xhtml: `<div class="scriba-export">${body}</div>`,
    css
  }
}

/**
 * Word-compatible HTML used for `.doc` export. Word opens HTML saved with a
 * `.doc` extension natively, so the rendered article is wrapped in the Office
 * namespace with a print-oriented stylesheet.
 */
/**
 * Replaces relative `<img src>` values with data URIs so exported documents are
 * self-contained. Remote URLs and already-inlined images are left untouched.
 */
async function inlineImages(html: string, docPath: string | null): Promise<string> {
  const matches = Array.from(html.matchAll(/<img\b[^>]*?\bsrc="([^"]*)"/gi))
  if (matches.length === 0) return html

  const sources = Array.from(
    new Set(matches.map((match) => match[1]).filter((src) => src && !src.startsWith('data:')))
  )

  const resolved = new Map<string, string>()
  await Promise.all(
    sources.map(async (src) => {
      try {
        const dataUri = await window.api.fs.readImageDataUri(docPath, src)
        if (dataUri) resolved.set(src, dataUri)
      } catch {
        // Leave the original source when the file cannot be read.
      }
    })
  )

  if (resolved.size === 0) return html

  return html.replace(/(<img\b[^>]*?\bsrc=")([^"]*)(")/gi, (whole, prefix: string, src: string, suffix: string) => {
    const dataUri = resolved.get(src)
    return dataUri ? `${prefix}${dataUri}${suffix}` : whole
  })
}

export async function renderWordHtml(
  markdownText: string,
  title: string,
  theme: string,
  options: ExportRenderOptions = {}
): Promise<string> {
  const page = await renderDocumentHtml(markdownText, title, theme, options)
  const marker = '<article class="scriba-export">'
  const start = page.indexOf(marker)
  const end = page.lastIndexOf('</article>')
  const raw = start >= 0 && end > start ? page.slice(start + marker.length, end) : page

  // Word only renders inline SVG when the root element declares the SVG namespace,
  // which Mermaid's output omits because it relies on the HTML parser.
  const content = raw.replace(/<svg\b(?![^>]*\bxmlns=)/gi, '<svg xmlns="http://www.w3.org/2000/svg"')

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page WordSection1 { size: 21cm 29.7cm; margin: 2.2cm; }
body { font-family: "Calibri", "Segoe UI", sans-serif; font-size: 11pt; line-height: 1.6; color: #1f2328; }
h1, h2, h3, h4, h5, h6 { color: #111; line-height: 1.3; }
h1 { font-size: 22pt; } h2 { font-size: 17pt; } h3 { font-size: 14pt; }
a { color: #0969da; }
blockquote { margin: 1em 0; padding-left: 12pt; border-left: 3pt solid #d0d7de; color: #57606a; }
code, pre { font-family: "Consolas", "Courier New", monospace; font-size: 10pt; }
pre { padding: 8pt; border: 1pt solid #d0d7de; background: #f6f8fa; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1pt solid #d0d7de; padding: 4pt 6pt; text-align: left; }
th { background: #f6f8fa; }
mark { background: #fff3a3; }
.toc { margin: 1em 0; padding: 8pt 12pt; border: 1pt solid #d0d7de; }
.toc ul { list-style: none; padding: 0; }
.footnotes { margin-top: 2em; border-top: 1pt solid #d0d7de; font-size: 9.5pt; }
.footnote-ref { vertical-align: super; font-size: 0.75em; }
img { max-width: 100%; }
/* Word does not render MathML; keep formulas legible via the math font and layout. */
.math-block { text-align: center; margin: 0.8em 0; }
.math-block math, .math-inline math { font-family: "Cambria Math", "Latin Modern Math", serif; }
.mermaid-export { text-align: center; margin: 1em 0; }
.mermaid-export svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
<div class="WordSection1">${content}</div>
</body>
</html>`
}
