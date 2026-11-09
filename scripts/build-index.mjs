#!/usr/bin/env node
/**
 * Builds a marketplace `index.json` from a folder of plugin packages.
 *
 * The index must agree with each plugin's own manifest — a mismatch makes installs
 * fail at the verification step. Generating it from the packages removes that class
 * of mistake entirely.
 *
 * Usage:
 *   node scripts/build-index.mjs <plugins-dir> [options]
 *
 * Options:
 *   --out <file>        Where to write the index (default: <plugins-dir>/index.json)
 *   --base-url <url>    Base URL prepended to each ZIP file name
 *   --version <n>       Index format version (default: 1)
 *
 * Each plugin package is either:
 *   - a directory containing manifest.json, or
 *   - a .zip whose root (or single top-level folder) contains manifest.json.
 *
 * With `--base-url`, `download` becomes `<base-url>/<file>.zip`; without it the
 * value is the bare file name, which is only useful for local testing.
 */
import { promises as fs } from 'node:fs'
import { join, basename, resolve, extname } from 'node:path'
import { inflateRawSync } from 'node:zlib'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50

/** Reads the first `manifest.json` found in a ZIP. Mirrors src/main/export/unzip.ts. */
function readManifestFromZip(buffer) {
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a ZIP archive')

  const count = buffer.readUInt16LE(eocd + 10)
  const centralOffset = buffer.readUInt32LE(eocd + 16)
  let pos = centralOffset

  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(pos) !== CENTRAL_SIGNATURE) throw new Error('corrupt ZIP')
    const method = buffer.readUInt16LE(pos + 10)
    const compressedSize = buffer.readUInt32LE(pos + 20)
    const nameLength = buffer.readUInt16LE(pos + 28)
    const extraLength = buffer.readUInt16LE(pos + 30)
    const commentLength = buffer.readUInt16LE(pos + 32)
    const localOffset = buffer.readUInt32LE(pos + 42)
    const name = buffer.slice(pos + 46, pos + 46 + nameLength).toString('utf8')
    pos += 46 + nameLength + extraLength + commentLength

    if (!name.endsWith('manifest.json')) continue
    if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) throw new Error('corrupt ZIP')

    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const raw = buffer.slice(start, start + compressedSize)
    const data = method === 0 ? raw : inflateRawSync(raw)
    return JSON.parse(data.toString('utf8'))
  }
  return null
}

function parseArgs(argv) {
  const args = { dir: null, out: null, baseUrl: '', version: 1 }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--out') args.out = argv[++i]
    else if (arg === '--base-url') args.baseUrl = (argv[++i] ?? '').replace(/\/+$/, '')
    else if (arg === '--version') args.version = Number(argv[++i])
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`)
    else rest.push(arg)
  }
  args.dir = rest[0]
  return args
}

/** Collects manifest + download URL for every plugin package in `dir`. */
async function collect(dir, baseUrl) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const plugins = []
  const problems = []

  for (const entry of entries) {
    const full = join(dir, entry.name)
    let manifest = null
    let zipName = null

    if (entry.isDirectory()) {
      const manifestPath = join(full, 'manifest.json')
      try {
        manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
      } catch {
        problems.push(`${entry.name}: no readable manifest.json`)
        continue
      }
      // Look for a matching ZIP next to the folder; otherwise require --base-url.
      const candidate = join(dir, `${entry.name}.zip`)
      if (await fs.stat(candidate).then((s) => s.isFile(), () => false)) {
        zipName = `${entry.name}.zip`
      }
    } else if (extname(entry.name).toLowerCase() === '.zip') {
      const buffer = await fs.readFile(full)
      try {
        manifest = readManifestFromZip(buffer)
      } catch (error) {
        problems.push(`${entry.name}: ${error.message}`)
        continue
      }
      zipName = entry.name
    } else {
      continue
    }

    if (!manifest) {
      problems.push(`${entry.name}: no manifest.json inside`)
      continue
    }
    for (const field of ['id', 'name', 'version']) {
      if (!manifest[field]) {
        problems.push(`${entry.name}: manifest is missing "${field}"`)
        manifest = null
        break
      }
    }
    if (!manifest) continue
    if (!zipName) {
      problems.push(`${manifest.id}: no .zip package found for this plugin`)
      continue
    }

    plugins.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      license: manifest.license,
      homepage: manifest.homepage,
      minAppVersion: manifest.minAppVersion,
      keywords: manifest.keywords,
      download: baseUrl ? `${baseUrl}/${zipName}` : zipName
    })
  }

  // Duplicate ids would make the installer ambiguous.
  const seen = new Map()
  for (const plugin of plugins) {
    if (seen.has(plugin.id)) {
      problems.push(`duplicate id "${plugin.id}"`)
    }
    seen.set(plugin.id, true)
  }

  plugins.sort((a, b) => a.name.localeCompare(b.name))
  return { plugins, problems }
}

/** Drops undefined fields so the output stays readable. */
function compact(object) {
  const result = {}
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined && value !== null && value !== '') result[key] = value
  }
  return result
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.dir) {
    console.error('Usage: node scripts/build-index.mjs <plugins-dir> [--out file] [--base-url url]')
    process.exit(2)
  }

  const dir = resolve(args.dir)
  const stat = await fs.stat(dir).catch(() => null)
  if (!stat?.isDirectory()) {
    console.error(`Not a directory: ${dir}`)
    process.exit(2)
  }

  const { plugins, problems } = await collect(dir, args.baseUrl)

  for (const problem of problems) console.warn(`warning: ${problem}`)

  if (plugins.length === 0) {
    console.error('No plugins found; refusing to write an empty index')
    process.exit(1)
  }

  const index = {
    version: args.version,
    plugins: plugins.map(compact)
  }

  const outPath = args.out ? resolve(args.out) : join(dir, 'index.json')
  await fs.writeFile(outPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${plugins.length} plugin(s) to ${outPath}`)
  for (const plugin of plugins) {
    console.log(`  ${plugin.id} v${plugin.version} -> ${plugin.download}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
