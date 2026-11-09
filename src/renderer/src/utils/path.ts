export function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? normalized.slice(0, Math.max(index, 0)) : normalized.slice(0, index)
}

export function isAbsolute(filePath: string): boolean {
  return /^([a-zA-Z]:[\\/]|[\\/]{2}|\/)/.test(filePath)
}

export function joinPath(base: string, relative: string): string {
  if (isAbsolute(relative)) return relative
  const separator = base.includes('\\') ? '\\' : '/'
  const parts = `${base.replace(/[\\/]+$/, '')}/${relative.replace(/\\/g, '/')}`.split('/')
  const stack: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      stack.pop()
      continue
    }
    stack.push(part)
  }
  const joined = stack.join('/')
  return separator === '\\' ? joined.replace(/\//g, '\\') : joined
}

export function toMediaUrl(absolutePath: string): string {
  return `scriba-media://local/?p=${encodeURIComponent(absolutePath)}`
}

function decodeLocalPath(path: string): string {
  if (!path.includes('%')) return path
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

export function resolveAsset(src: string, docPath: string | null): string {
  if (/^(https?:|data:|blob:|scriba-media:|file:)/i.test(src)) return src
  const local = decodeLocalPath(src)
  if (isAbsolute(local)) return toMediaUrl(local)
  if (!docPath) return src
  return toMediaUrl(joinPath(dirname(docPath), local))
}
