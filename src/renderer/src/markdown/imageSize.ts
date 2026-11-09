/**
 * Image size syntax, appended after the URL inside the parentheses:
 *
 *   ![alt](pic.png =200x)      fixed width, height auto
 *   ![alt](pic.png =200x150)   fixed width and height
 *   ![alt](pic.png =x150)      fixed height, width auto
 *
 * The value is expressed in CSS pixels. Keeping the parser in one module lets the
 * live preview and the HTML export agree on the same rules.
 */
export interface ImageSize {
  width?: number
  height?: number
}

export interface ParsedImage {
  alt: string
  src: string
  title?: string
  size: ImageSize | null
}

/** Upper bound so a typo cannot produce an enormous off-screen image. */
const MAX_DIMENSION = 5000

function parseDimension(value: string | undefined): number | undefined {
  if (!value) return undefined
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return undefined
  return Math.min(Math.round(number), MAX_DIMENSION)
}

/**
 * Parses the trailing `=WxH` size suffix from an image URL.
 * Returns the cleaned URL plus the parsed size, or a null size when absent.
 */
export function parseImageSize(rawUrl: string): { src: string; size: ImageSize | null } {
  // Allow optional spaces around `=` and `x`, which authors commonly write.
  const match = /\s*=\s*(\d*)\s*x\s*(\d*)\s*$/.exec(rawUrl)
  if (!match) return { src: rawUrl.trim(), size: null }

  const width = parseDimension(match[1])
  const height = parseDimension(match[2])
  // `=x` or `=` alone carries no information; treat the URL as-is.
  if (width === undefined && height === undefined) {
    return { src: rawUrl.trim(), size: null }
  }

  return {
    src: rawUrl.slice(0, match.index).trim(),
    size: { ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}) }
  }
}

/** Parses a whole `![alt](src "title" =WxH)` construct. */
export function parseImageToken(token: string): ParsedImage | null {
  const match = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*(=\s*\d*\s*x\s*\d*\s*)?\)$/.exec(
    token
  )
  if (!match) return null

  const rawSrc = match[2]
  const sizeSuffix = match[4]
  let size: ImageSize | null = null
  let src = rawSrc

  if (sizeSuffix) {
    const parsed = parseImageSize(rawSrc + sizeSuffix)
    src = parsed.src
    size = parsed.size
  }

  return {
    alt: match[1],
    src,
    ...(match[3] ? { title: match[3] } : {}),
    size
  }
}

/** Inline `width`/`height` attributes for an exported `<img>` tag. */
export function sizeAttributes(size: ImageSize | null): string {
  if (!size) return ''
  const parts: string[] = []
  if (size.width) parts.push(`width="${size.width}"`)
  if (size.height) parts.push(`height="${size.height}"`)
  return parts.length > 0 ? ` ${parts.join(' ')}` : ''
}
