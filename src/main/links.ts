/**
 * Helpers for rewriting Markdown links when a file is renamed or moved.
 *
 * References to a renamed document are updated so links do not silently break.
 * Only Markdown link/image destinations are touched; fenced code blocks and inline
 * code spans are skipped so example snippets stay intact.
 */

export interface LinkRewrite {
  /** Path of the file whose contents should change. */
  path: string
  content: string
  /** Number of references replaced, for reporting to the user. */
  replacements: number
}

/** Escapes a string for literal use inside a RegExp. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Splits text into segments that are safe to rewrite and code segments that must
 * be left alone. Returns the original text with code regions preserved verbatim.
 */
function mapOutsideCode(
  text: string,
  transform: (segment: string) => string
): string {
  const lines = text.split('\n')
  const out: string[] = []
  let fenceChar = ''
  let fenceLength = 0

  for (const line of lines) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) {
      const char = fence[1][0]
      if (!fenceChar) {
        fenceChar = char
        fenceLength = fence[1].length
      } else if (char === fenceChar && fence[1].length >= fenceLength) {
        fenceChar = ''
      }
      out.push(line)
      continue
    }
    if (fenceChar) {
      out.push(line)
      continue
    }

    // Protect inline code spans by replacing them with placeholders first.
    const spans: string[] = []
    const guarded = line.replace(/`[^`]*`/g, (span) => {
      spans.push(span)
      return `\u0000CODE${spans.length - 1}\u0000`
    })
    let replaced = transform(guarded)
    replaced = replaced.replace(/\u0000CODE(\d+)\u0000/g, (_m, index: string) => spans[Number(index)] ?? '')
    out.push(replaced)
  }

  return out.join('\n')
}

/**
 * Rewrites links that point at `oldRelative` so they point at `newRelative`.
 *
 * Both are paths relative to the directory of the file being edited. The function
 * matches the destination as written (`old.md`, `./old.md`, `sub/old.md`) and
 * preserves any `#anchor` suffix and the link title.
 */
export function rewriteLinks(
  content: string,
  oldRelative: string,
  newRelative: string
): { content: string; replacements: number } {
  let replacements = 0
  const oldNorm = oldRelative.replace(/\\/g, '/')
  const newNorm = newRelative.replace(/\\/g, '/')

  // A rename that keeps the same name (e.g. only the extension changed case) needs
  // no rewriting, and must not report phantom replacements.
  if (oldNorm === newNorm) return { content, replacements: 0 }

  const rewritten = mapOutsideCode(content, (segment) =>
    segment.replace(
      /(!?\[[^\]]*\]\(\s*)([^)\s]+)((?:\s+"[^"]*")?\s*\))/g,
      (whole, prefix: string, dest: string, suffix: string) => {
        // Separate the anchor so `old.md#section` keeps its fragment.
        const hashIndex = dest.indexOf('#')
        const target = hashIndex >= 0 ? dest.slice(0, hashIndex) : dest
        const anchor = hashIndex >= 0 ? dest.slice(hashIndex) : ''

        if (!target) return whole

        const decoded = (() => {
          try {
            return decodeURI(target)
          } catch {
            return target
          }
        })()

        const normalized = decoded.replace(/\\/g, '/').replace(/^\.\//, '')
        if (normalized !== oldNorm) return whole

        replacements += 1
        // Preserve the `./` prefix style the author used.
        const hadDotSlash = decoded.startsWith('./')
        const replacement = hadDotSlash ? `./${newNorm}` : newNorm
        return `${prefix}${replacement}${anchor}${suffix}`
      }
    )
  )

  return { content: rewritten, replacements }
}

/** Relative path from one directory to another, using forward slashes. */
export function relativeLink(fromDir: string, targetPath: string): string {
  const from = fromDir.replace(/\\/g, '/').replace(/\/+$/, '')
  const to = targetPath.replace(/\\/g, '/')
  const fromParts = from.split('/').filter(Boolean)
  const toParts = to.split('/').filter(Boolean)

  // Windows paths are case-insensitive; compare accordingly when finding the root.
  let common = 0
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common].toLowerCase() === toParts[common].toLowerCase()
  ) {
    common += 1
  }

  const ups = fromParts.length - common
  const rest = toParts.slice(common)
  return [...Array(ups).fill('..'), ...rest].join('/')
}

/** Normalizes a path for comparison inside the rewriter. */
export function normalizeLinkPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

/** True when the destination looks like a link we can rewrite (not a URL/anchor). */
export function isRewritableLink(dest: string): boolean {
  return !/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(dest)
}

export { escapeRegExp }
