import { promises as fs } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { createZip, type ZipEntry } from './zip'

/**
 * Builds an EPUB 3 archive from a rendered content document.
 *
 * The structure is the minimal one readers accept: an uncompressed `mimetype`
 * entry first, then `META-INF/container.xml`, the package document, a navigation
 * document and the XHTML content. Images referenced by the content are copied in
 * and their `src` attributes rewritten to the archive path.
 */

export interface EpubInput {
  title: string
  /** XHTML fragment for the document body. */
  xhtml: string
  /** CSS embedded in the content document. */
  css: string
  /** Source document path, used to resolve relative image references. */
  docPath?: string | null
  author?: string
  language?: string
}

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif'
}

/** XML-escapes text for use in an XHTML/XML document. */
function xml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function mimeFor(fileName: string): string | null {
  const ext = extname(fileName).replace('.', '').toLowerCase()
  return MEDIA_TYPES[ext] ?? null
}

/**
 * Collects images referenced by the content, copies them into `OEBPS/images/`
 * and rewrites the `src` attributes to point at the archive copies.
 */
async function collectImages(
  xhtml: string,
  docPath: string | null
): Promise<{ xhtml: string; entries: ZipEntry[] }> {
  const entries: ZipEntry[] = []
  const seen = new Map<string, string>()
  let index = 0

  const matches = Array.from(xhtml.matchAll(/<img\b[^>]*?\bsrc="([^"]+)"/gi))
  let rewritten = xhtml

  for (const match of matches) {
    const src = match[1]
    // Remote and already-inlined images are left as-is; EPUB readers handle
    // remote URLs poorly, but rewriting them is out of scope here.
    if (/^(data:|https?:|blob:)/i.test(src)) continue
    if (!docPath) continue

    const absolute = /^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('/')
      ? src
      : join(dirname(docPath), decodeURI(src.replace(/^file:\/\//i, '')))

    const mime = mimeFor(absolute)
    if (!mime) continue

    let archiveName = seen.get(absolute)
    if (!archiveName) {
      try {
        const data = await fs.readFile(absolute)
        const ext = extname(absolute).toLowerCase()
        archiveName = `images/image-${index++}${ext}`
        entries.push({ name: `OEBPS/${archiveName}`, data })
        seen.set(absolute, archiveName)
      } catch {
        // Missing files are skipped; the content keeps its original reference.
        continue
      }
    }

    rewritten = rewritten.split(`src="${src}"`).join(`src="${archiveName}"`)
  }

  return { xhtml: rewritten, entries }
}

function contentXhtml(input: EpubInput, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<meta charset="utf-8" />
<title>${xml(input.title)}</title>
<link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
${body}
</body>
</html>`
}

interface TocEntry {
  level: number
  text: string
  id: string
}

/**
 * Adds an `id` to every heading in the content and returns the entries for the
 * navigation document.
 *
 * EPUB readers build their table of contents from `nav.xhtml`, so headings need
 * stable anchors. A single "whole document" entry would make every book a
 * one-item list, which is what this replaces.
 */
function annotateHeadings(xhtml: string): { xhtml: string; toc: TocEntry[] } {
  const toc: TocEntry[] = []
  let index = 0

  const rewritten = xhtml.replace(
    /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (whole, levelText: string, attrs: string | undefined, inner: string) => {
      const level = Number(levelText)
      // Strip inline markup so the navigation label is plain text.
      const text = inner
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!text) return whole

      const id = `sec-${index++}`
      toc.push({ level, text, id })
      // Preserve any existing attributes, dropping a stale id if present.
      const cleaned = (attrs ?? '').replace(/\sid="[^"]*"/gi, '')
      return `<h${levelText}${cleaned} id="${id}">${inner}</h${levelText}>`
    }
  )

  return { xhtml: rewritten, toc }
}

/**
 * Builds the navigation document as a nested list.
 *
 * Levels can jump (h1 straight to h3), so entries are nested by comparing against
 * the level of the currently open list rather than assuming a fixed step.
 */
function navXhtml(title: string, toc: TocEntry[]): string {
  if (toc.length === 0) {
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8" /><title>${xml(title)}</title></head>
<body>
<nav epub:type="toc" id="toc">
<h1>${xml(title)}</h1>
<ol><li><a href="content.xhtml">${xml(title)}</a></li></ol>
</nav>
</body>
</html>`
  }

  const lines: string[] = []
  // Stack of levels whose <ol> is currently open.
  const stack: number[] = []
  const indent = (): string => '  '.repeat(stack.length + 1)

  for (const entry of toc) {
    while (stack.length > 0 && entry.level <= stack[stack.length - 1]) {
      stack.pop()
      lines.push(`${indent()}</ol></li>`)
    }
    lines.push(`${indent()}<li><a href="content.xhtml#${entry.id}">${xml(entry.text)}</a>`)
    stack.push(entry.level)
    lines.push(`${indent()}<ol>`)
  }

  while (stack.length > 0) {
    stack.pop()
    lines.push(`${indent()}</ol></li>`)
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8" /><title>${xml(title)}</title></head>
<body>
<nav epub:type="toc" id="toc">
<h1>${xml(title)}</h1>
<ol>
${lines.join('\n')}
</ol>
</nav>
</body>
</html>`
}

function packageOpf(input: EpubInput, imageEntries: ZipEntry[]): string {
  const manifestImages = imageEntries
    .map((entry, i) => {
      const id = `img${i}`
      const href = entry.name.replace(/^OEBPS\//, '')
      const mime = mimeFor(entry.name) ?? 'application/octet-stream'
      return `    <item id="${id}" href="${href}" media-type="${mime}" />`
    })
    .join('\n')

  const identifier = `urn:scriba:${Buffer.from(input.title).toString('hex').slice(0, 32)}`

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${xml(identifier)}</dc:identifier>
    <dc:title>${xml(input.title)}</dc:title>
    <dc:language>${xml(input.language ?? 'en')}</dc:language>
${input.author ? `    <dc:creator>${xml(input.author)}</dc:creator>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml" />
    <item id="style" href="style.css" media-type="text/css" />
${manifestImages}
  </manifest>
  <spine>
    <itemref idref="content" />
  </spine>
</package>`
}

const CONTAINER_XML = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`

/** Assembles the EPUB archive and writes it to `targetPath`. */
export async function writeEpub(input: EpubInput, targetPath: string): Promise<void> {
  const { xhtml, entries: imageEntries } = await collectImages(input.xhtml, input.docPath ?? null)
  // Headings become anchors so the navigation document can link to each section.
  const { xhtml: withAnchors, toc } = annotateHeadings(xhtml)

  const entries: ZipEntry[] = [
    // `mimetype` must be first and stored uncompressed.
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: CONTAINER_XML },
    { name: 'OEBPS/content.opf', data: packageOpf(input, imageEntries) },
    { name: 'OEBPS/nav.xhtml', data: navXhtml(input.title, toc) },
    { name: 'OEBPS/content.xhtml', data: contentXhtml(input, withAnchors) },
    { name: 'OEBPS/style.css', data: input.css },
    ...imageEntries
  ]

  const archive = createZip(entries)
  await fs.mkdir(dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, archive)
}

/** Default file name for a document, used by the save dialog. */
export function epubFileName(docName: string): string {
  return `${basename(docName).replace(/\.[^.]+$/, '')}.epub`
}
