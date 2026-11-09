// Tests for manifest localisation (plugin display names per interface language).
//
// Run with:  npm run test:compat
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Transpile the real modules so the tests track shipping code.
function load(relPath, outName) {
  const source = readFileSync(join(ROOT, relPath), 'utf8')
  const js = transformSync(source, { loader: 'ts', format: 'esm' }).code
  mkdirSync(join(ROOT, 'out'), { recursive: true })
  const tmp = join(ROOT, 'out', outName)
  writeFileSync(tmp, js)
  return pathToFileURL(tmp).href
}

const specUrl = load('src/shared/pluginSpec.ts', '.test-pluginSpec.mjs')
const versionUrl = load('src/shared/version.ts', '.test-version.mjs')

const { localizeManifest, validateManifest } = await import(specUrl)
const { isCompatible, satisfiesMinVersion, compareVersions } = await import(versionUrl)

const cases = []
function check(name, fn) {
  try {
    fn()
    cases.push({ name, ok: true })
  } catch (error) {
    cases.push({ name, ok: false, message: error.message })
  }
}

// ── version compatibility (marketplace install bug) ────────────────────────
check('equal versions are compatible', () => {
  assert.strictEqual(isCompatible({ minAppVersion: '0.1.0' }, '0.1.0'), true)
})

check('older requirement is compatible', () => {
  assert.strictEqual(isCompatible({ minAppVersion: '0.0.1' }, '0.1.0'), true)
})

check('newer requirement is incompatible', () => {
  assert.strictEqual(isCompatible({ minAppVersion: '9.9.9' }, '0.1.0'), false)
})

check('missing requirement is compatible', () => {
  assert.strictEqual(isCompatible({}, '0.1.0'), true)
  assert.strictEqual(isCompatible({ minAppVersion: '' }, '0.1.0'), true)
})

check('the removed lexicographic comparison gave the opposite answer', () => {
  const buggy = '0.1.0'.localeCompare('0.0.0') > 0
  assert.strictEqual(buggy, true, 'the old expression flagged this as incompatible')
  assert.strictEqual(isCompatible({ minAppVersion: '0.1.0' }, '0.1.0'), true)
})

check('numeric comparison, not lexicographic', () => {
  assert.ok(compareVersions('0.10.0', '0.9.0') > 0)
  assert.ok(satisfiesMinVersion('0.10.0', '0.9.0'))
})

check('a prerelease suffix is ignored, by design', () => {
  assert.strictEqual(satisfiesMinVersion('1.0.0', '1.0.0-beta.1'), true)
  assert.strictEqual(satisfiesMinVersion('1.0.0-beta.1', '1.0.0'), true)
  assert.strictEqual(satisfiesMinVersion('0.9.0', '1.0.0-beta.1'), false)
})

// ── manifest localisation ─────────────────────────────────────────────────
const manifest = {
  name: 'Reading Time',
  description: 'Estimates reading time.',
  i18n: {
    'ja-JP': { name: '読了時間', description: '読むのにかかる時間を見積もります。' },
    'zh-CN': { name: '阅读时间', description: '估算阅读时长。' }
  }
}

check('exact language match is used', () => {
  const out = localizeManifest(manifest, 'ja-JP')
  assert.strictEqual(out.name, '読了時間')
  assert.strictEqual(out.description, '読むのにかかる時間を見積もります。')
})

check('region falls back to the base language', () => {
  const out = localizeManifest(manifest, 'ja')
  assert.strictEqual(out.name, '読了時間')
})

check('a region-specific entry beats a bare-language one', () => {
  const both = {
    name: 'Base',
    i18n: {
      ja: { name: 'ベース' },
      'ja-JP': { name: '日本' }
    }
  }
  assert.strictEqual(localizeManifest(both, 'ja-JP').name, '日本')
  assert.strictEqual(localizeManifest(both, 'ja-Kansai').name, 'ベース')
})

check('unknown language falls back to the manifest strings', () => {
  const out = localizeManifest(manifest, 'fr-FR')
  assert.strictEqual(out.name, 'Reading Time')
  assert.strictEqual(out.description, 'Estimates reading time.')
})

check('no i18n block leaves everything untouched', () => {
  const out = localizeManifest({ name: 'Plain', description: 'No translations' }, 'ja-JP')
  assert.strictEqual(out.name, 'Plain')
  assert.strictEqual(out.description, 'No translations')
})

check('a partial entry keeps the field it does not override', () => {
  const out = localizeManifest(
    { name: 'Base', description: 'Base desc', i18n: { 'ja-JP': { name: '日本語名' } } },
    'ja-JP'
  )
  assert.strictEqual(out.name, '日本語名')
  assert.strictEqual(out.description, 'Base desc')
})

check('blank translations are ignored rather than showing empty text', () => {
  const out = localizeManifest(
    { name: 'Base', description: 'Base desc', i18n: { 'ja-JP': { name: '   ' } } },
    'ja-JP'
  )
  assert.strictEqual(out.name, 'Base')
})

check('language tag matching is case-insensitive', () => {
  assert.strictEqual(localizeManifest(manifest, 'JA-jp').name, '読了時間')
})

// ── manifest validation of the new field ──────────────────────────────────
check('a valid i18n block passes validation', () => {
  const issues = validateManifest({
    id: 'reading-time',
    name: 'Reading Time',
    version: '1.1.0',
    i18n: { 'ja-JP': { name: '読了時間', description: '説明' } }
  })
  assert.deepStrictEqual(issues, [])
})

check('a non-object i18n block is reported', () => {
  const issues = validateManifest({
    id: 'reading-time',
    name: 'Reading Time',
    version: '1.1.0',
    i18n: 'nope'
  })
  assert.ok(issues.some((i) => i.field === 'i18n'))
})

check('a non-string translated field is reported', () => {
  const issues = validateManifest({
    id: 'reading-time',
    name: 'Reading Time',
    version: '1.1.0',
    i18n: { 'ja-JP': { name: 42 } }
  })
  assert.ok(issues.some((i) => i.field === 'i18n.ja-JP.name'))
})

let failed = 0
for (const c of cases) {
  if (c.ok) {
    console.log('PASS ' + c.name)
  } else {
    failed += 1
    console.log('FAIL ' + c.name + ' :: ' + c.message)
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
