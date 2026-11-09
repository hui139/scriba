import { inflateRawSync } from 'node:zlib'

/**
 * Minimal ZIP reader, enough to unpack a plugin archive.
 *
 * Only what plugin distribution needs is supported: stored and deflated entries,
 * a central directory, and the end-of-central-directory record. ZIP64, encryption
 * and multi-disk archives are rejected rather than mis-parsed.
 *
 * Reading ZIPs is done here instead of adding a general-purpose archiver so the
 * dependency surface stays small and the behaviour is auditable.
 */

export interface ZipEntryData {
  /** Path inside the archive, normalized to forward slashes. */
  name: string
  /** Uncompressed bytes. */
  data: Buffer
  /** True when the entry represents a directory. */
  isDirectory: boolean
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50

/** Guards against zip bombs: refuses archives whose inflated size exceeds this. */
const MAX_TOTAL_SIZE = 64 * 1024 * 1024

export class ZipError extends Error {}

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The EOCD record is at least 22 bytes and sits at the end, possibly followed by
  // a comment of up to 64 KB.
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff)
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i
  }
  return -1
}

/**
 * Normalizes an archive path and rejects entries that would escape the target
 * directory (`../`, absolute paths, drive letters).
 */
function safeEntryName(raw: string): string | null {
  const name = raw.replace(/\\/g, '/')
  if (!name) return null
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return null
  const parts: string[] = []
  for (const part of name.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') return null
    parts.push(part)
  }
  if (parts.length === 0) return null
  return parts.join('/')
}

/** Parses a ZIP archive into its entries. Throws `ZipError` on malformed input. */
export function readZip(buffer: Buffer): ZipEntryData[] {
  if (buffer.length < 22) throw new ZipError('File is too small to be a ZIP archive')

  const eocd = findEndOfCentralDirectory(buffer)
  if (eocd < 0) throw new ZipError('Not a ZIP archive (no end-of-central-directory record)')

  const entryCount = buffer.readUInt16LE(eocd + 10)
  const centralSize = buffer.readUInt32LE(eocd + 12)
  const centralOffset = buffer.readUInt32LE(eocd + 16)

  if (centralOffset === 0xffffffff || entryCount === 0xffff) {
    throw new ZipError('ZIP64 archives are not supported')
  }
  if (centralOffset + centralSize > buffer.length) {
    throw new ZipError('Central directory is out of bounds')
  }

  const entries: ZipEntryData[] = []
  let totalSize = 0
  let pos = centralOffset

  for (let i = 0; i < entryCount; i++) {
    if (pos + 46 > buffer.length) throw new ZipError('Truncated central directory')
    if (buffer.readUInt32LE(pos) !== CENTRAL_SIGNATURE) {
      throw new ZipError('Corrupt central directory entry')
    }

    const method = buffer.readUInt16LE(pos + 10)
    const compressedSize = buffer.readUInt32LE(pos + 20)
    const uncompressedSize = buffer.readUInt32LE(pos + 24)
    const nameLength = buffer.readUInt16LE(pos + 28)
    const extraLength = buffer.readUInt16LE(pos + 30)
    const commentLength = buffer.readUInt16LE(pos + 32)
    const localOffset = buffer.readUInt32LE(pos + 42)
    const rawName = buffer.slice(pos + 46, pos + 46 + nameLength).toString('utf8')

    pos += 46 + nameLength + extraLength + commentLength

    // Directory entries carry no payload.
    if (rawName.endsWith('/')) {
      const name = safeEntryName(rawName)
      if (name) entries.push({ name, data: Buffer.alloc(0), isDirectory: true })
      continue
    }

    const name = safeEntryName(rawName)
    if (!name) continue // Skip unsafe paths instead of failing the whole archive.

    if (localOffset + 30 > buffer.length) throw new ZipError('Local header out of bounds')
    if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw new ZipError('Corrupt local file header')
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > buffer.length) throw new ZipError('Entry data is out of bounds')

    const raw = buffer.slice(dataStart, dataEnd)
    let data: Buffer
    if (method === 0) {
      data = raw
    } else if (method === 8) {
      try {
        data = inflateRawSync(raw)
      } catch {
        throw new ZipError(`Failed to inflate "${name}"`)
      }
    } else {
      throw new ZipError(`Unsupported compression method ${method} for "${name}"`)
    }

    totalSize += data.length
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new ZipError('Archive expands beyond the allowed size')
    }
    // Trust the actual inflated length over the header, which a malicious archive
    // could understate.
    if (uncompressedSize !== 0 && data.length !== uncompressedSize) {
      // A mismatch is not fatal for reading, but flag clearly corrupt archives.
      if (data.length < uncompressedSize) throw new ZipError(`Entry "${name}" is truncated`)
    }

    entries.push({ name, data, isDirectory: false })
  }

  return entries
}

/**
 * Locates the directory that actually contains `manifest.json`.
 *
 * Archives are commonly wrapped in a single top-level folder (`my-plugin/...`).
 * Returns the prefix to strip, or '' when the manifest is at the root.
 */
export function findPluginRoot(entries: ZipEntryData[]): string | null {
  const manifests = entries.filter(
    (entry) => !entry.isDirectory && entry.name.split('/').pop() === 'manifest.json'
  )
  if (manifests.length === 0) return null

  // Prefer the shallowest manifest; that is the plugin root.
  manifests.sort((a, b) => a.name.split('/').length - b.name.split('/').length)
  const parts = manifests[0].name.split('/')
  return parts.length === 1 ? '' : parts.slice(0, -1).join('/')
}
