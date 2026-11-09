import { deflateRawSync } from 'node:zlib'

/**
 * Minimal ZIP writer, just enough for the EPUB container.
 *
 * EPUB is a ZIP archive, so writing one needs the container format but nothing
 * else. Using Node's built-in zlib keeps this dependency-free instead of pulling
 * in a general-purpose archiver for a single export path.
 *
 * Only what EPUB readers require is implemented: stored/deflated entries, a
 * central directory and the end-of-central-directory record. No ZIP64, no
 * encryption, no data descriptors.
 */

export interface ZipEntry {
  /** Path inside the archive, always with forward slashes. */
  name: string
  data: Buffer | string
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let value = i
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[i] = value
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = -1
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

interface PreparedEntry {
  nameBytes: Buffer
  compressed: Buffer
  crc: number
  uncompressedSize: number
  method: number
  offset: number
}

/** Builds a ZIP archive from the given entries. */
export function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = []
  const prepared: PreparedEntry[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8')
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8')
    const crc = crc32(raw)

    // `mimetype` must be stored uncompressed and first, per the EPUB spec.
    const store = entry.name === 'mimetype'
    const compressed = store ? raw : deflateRawSync(raw, { level: 9 })
    const method = store ? 0 : 8

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0) // local file header signature
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(0, 10) // mod time
    local.writeUInt16LE(0x21, 12) // mod date (1980-01-01)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28) // extra field length

    localParts.push(local, nameBytes, compressed)
    prepared.push({
      nameBytes,
      compressed,
      crc,
      uncompressedSize: raw.length,
      method,
      offset
    })
    offset += local.length + nameBytes.length + compressed.length
  }

  const centralParts: Buffer[] = []
  let centralSize = 0
  for (const entry of prepared) {
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0) // central directory signature
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(0, 8) // flags
    central.writeUInt16LE(entry.method, 10)
    central.writeUInt16LE(0, 12) // mod time
    central.writeUInt16LE(0x21, 14) // mod date
    central.writeUInt32LE(entry.crc, 16)
    central.writeUInt32LE(entry.compressed.length, 20)
    central.writeUInt32LE(entry.uncompressedSize, 24)
    central.writeUInt16LE(entry.nameBytes.length, 28)
    central.writeUInt16LE(0, 30) // extra length
    central.writeUInt16LE(0, 32) // comment length
    central.writeUInt16LE(0, 34) // disk number
    central.writeUInt16LE(0, 36) // internal attributes
    central.writeUInt32LE(0, 38) // external attributes
    central.writeUInt32LE(entry.offset, 42)

    centralParts.push(central, entry.nameBytes)
    centralSize += central.length + entry.nameBytes.length
  }

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // end of central directory signature
  end.writeUInt16LE(0, 4) // disk number
  end.writeUInt16LE(0, 6) // central directory start disk
  end.writeUInt16LE(prepared.length, 8)
  end.writeUInt16LE(prepared.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...localParts, ...centralParts, end])
}
