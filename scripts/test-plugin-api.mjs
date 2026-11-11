// Tests for the plugin API surface: ownership rules and editor helpers.
//
// These run in plain Node against the extracted logic where possible; the parts that
// need CodeMirror are exercised through the real app by scripts/verify-plugin-api.cjs.
//
// Run with:  npm run test:compat   (part of the test suite)
import assert from 'node:assert'

const cases = []
function check(name, fn) {
  try {
    fn()
    cases.push({ name, ok: true })
  } catch (error) {
    cases.push({ name, ok: false, message: error.message })
  }
}

// ── line-number clamping, mirroring editor.getLine / getLineStart ──────────
const TOTAL_LINES = 5

function clampLine(n) {
  if (!Number.isFinite(n) || n < 1 || n > TOTAL_LINES) return null
  return Math.floor(n)
}

check('valid line numbers pass through', () => {
  assert.strictEqual(clampLine(1), 1)
  assert.strictEqual(clampLine(5), 5)
})

check('out-of-range line numbers yield null, not a throw', () => {
  assert.strictEqual(clampLine(0), null)
  assert.strictEqual(clampLine(6), null)
  assert.strictEqual(clampLine(-1), null)
})

check('non-numeric line numbers yield null', () => {
  assert.strictEqual(clampLine(NaN), null)
  assert.strictEqual(clampLine(Infinity), null)
})

check('fractional line numbers are floored', () => {
  assert.strictEqual(clampLine(2.9), 2)
})

// ── cursor column clamping, mirroring editor.setCursor ────────────────────
function clampCol(col, lineLength) {
  return Math.max(0, Math.min((col || 1) - 1, lineLength))
}

check('column is clamped to the line length', () => {
  assert.strictEqual(clampCol(1, 10), 0)
  assert.strictEqual(clampCol(11, 10), 10)
  assert.strictEqual(clampCol(999, 10), 10)
})

check('missing column defaults to the start of the line', () => {
  assert.strictEqual(clampCol(undefined, 10), 0)
  assert.strictEqual(clampCol(0, 10), 0)
})

// ── ownership rules for unregister ────────────────────────────────────────
const registry = new Map([
  ['mine.one', 'me'],
  ['other.one', 'someone-else']
])

function canRemove(id, pluginId) {
  const owner = registry.get(id)
  return owner === pluginId
}

check('a plugin can remove its own command', () => {
  assert.strictEqual(canRemove('mine.one', 'me'), true)
})

check('a plugin cannot remove another plugin\'s command', () => {
  assert.strictEqual(canRemove('other.one', 'me'), false)
})

check('removing an unknown id is refused', () => {
  assert.strictEqual(canRemove('does.not.exist', 'me'), false)
})

// ── theme switching must reject unknown ids ───────────────────────────────
const THEMES = ['violet-night', 'light', 'dark', 'solarized-light', 'solarized-dark', 'nord']
function canSwitchTheme(id) {
  return THEMES.includes(id)
}

check('known themes are accepted', () => {
  assert.strictEqual(canSwitchTheme('light'), true)
  assert.strictEqual(canSwitchTheme('violet-night'), true)
})

check('an unknown theme is rejected instead of blanking the UI', () => {
  assert.strictEqual(canSwitchTheme('no-such-theme'), false)
  assert.strictEqual(canSwitchTheme(''), false)
})

// ── storage keys must stay inside the plugin namespace ───────────────────
function namespaceKey(pluginId, key) {
  return `scriba-plugin:${pluginId}:${key}`
}

function visibleKeys(allKeys, pluginId) {
  const prefix = `scriba-plugin:${pluginId}:`
  return allKeys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length))
}

check('storage.keys only lists the plugin\'s own keys', () => {
  const all = [
    'scriba-plugin:alpha:one',
    'scriba-plugin:alpha:two',
    'scriba-plugin:beta:three',
    'scriba-settings'
  ]
  assert.deepStrictEqual(visibleKeys(all, 'alpha'), ['one', 'two'])
  assert.deepStrictEqual(visibleKeys(all, 'beta'), ['three'])
})

check('a plugin cannot see host storage', () => {
  assert.deepStrictEqual(visibleKeys(['scriba-settings', 'scriba-i18n'], 'alpha'), [])
})

check('the namespace prefix is applied consistently', () => {
  assert.strictEqual(namespaceKey('alpha', 'one'), 'scriba-plugin:alpha:one')
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
