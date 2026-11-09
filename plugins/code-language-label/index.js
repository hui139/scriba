/**
 * Code Language Label
 *
 * Adds a small language badge to every fenced code block in the live preview.
 * The language comes from the fence info string (` ```js `); when the fence has
 * no language, it is inferred from the code itself.
 *
 * Clicking a badge opens a language picker. Choosing a language rewrites the
 * fence info string in the document, so the override is saved with the file.
 */

var LANG_ATTR = 'data-scriba-code-lang'

var MESSAGES = {
  'en-US': {
    'code-language-label.text': 'Text',
    'code-language-label.auto': 'Auto detect',
    'code-language-label.search': 'Search or type a language'
  },
  'zh-CN': {
    'code-language-label.text': '纯文本',
    'code-language-label.auto': '自动检测',
    'code-language-label.search': '搜索或输入语言'
  }
}

var ALIASES = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  sh: 'Shell',
  bash: 'Shell',
  shell: 'Shell',
  zsh: 'Shell',
  fish: 'Shell',
  ps1: 'PowerShell',
  powershell: 'PowerShell',
  bat: 'Batch',
  cmd: 'Batch',
  html: 'HTML',
  htm: 'HTML',
  xml: 'XML',
  svg: 'SVG',
  vue: 'Vue',
  svelte: 'Svelte',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  json: 'JSON',
  jsonc: 'JSON',
  json5: 'JSON5',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  ini: 'INI',
  sql: 'SQL',
  mysql: 'SQL',
  postgresql: 'SQL',
  sqlite: 'SQL',
  c: 'C',
  h: 'C',
  cpp: 'C++',
  'c++': 'C++',
  cc: 'C++',
  hpp: 'C++',
  cs: 'C#',
  csharp: 'C#',
  java: 'Java',
  kotlin: 'Kotlin',
  kt: 'Kotlin',
  swift: 'Swift',
  go: 'Go',
  golang: 'Go',
  rust: 'Rust',
  rs: 'Rust',
  php: 'PHP',
  lua: 'Lua',
  dart: 'Dart',
  r: 'R',
  scala: 'Scala',
  perl: 'Perl',
  pl: 'Perl',
  haskell: 'Haskell',
  hs: 'Haskell',
  elixir: 'Elixir',
  ex: 'Elixir',
  erlang: 'Erlang',
  clojure: 'Clojure',
  clj: 'Clojure',
  mermaid: 'Mermaid',
  markdown: 'Markdown',
  md: 'Markdown',
  dockerfile: 'Dockerfile',
  docker: 'Dockerfile',
  makefile: 'Makefile',
  diff: 'Diff',
  patch: 'Diff',
  text: 'Text',
  txt: 'Text',
  plaintext: 'Text'
}

var CHOICES = [
  '',
  'text',
  'js',
  'ts',
  'jsx',
  'tsx',
  'py',
  'java',
  'c',
  'cpp',
  'cs',
  'go',
  'rust',
  'rb',
  'php',
  'swift',
  'kotlin',
  'dart',
  'lua',
  'r',
  'scala',
  'sql',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'xml',
  'sh',
  'powershell',
  'markdown',
  'mermaid',
  'dockerfile',
  'diff'
]

function textLabel(scriba) {
  return scriba.i18n.t('code-language-label.text')
}

function prettify(tag) {
  if (!tag) return ''
  return tag.charAt(0).toUpperCase() + tag.slice(1)
}

function languageFor(scriba, declared, code) {
  if (declared) return ALIASES[declared] || prettify(declared)
  if (!code.trim()) return ''
  return detectLanguage(code) || textLabel(scriba)
}

/** Heuristic detection for fences without an info string. */
function detectLanguage(code) {
  var text = code.trim()
  if (!text) return ''

  if (text.charAt(0) === '{' || text.charAt(0) === '[') {
    try {
      JSON.parse(text)
      return 'JSON'
    } catch (error) {
      // Not JSON; keep looking.
    }
  }

  if (/^<!doctype\s+html/i.test(text) || /<\/?(html|head|body|div|span|section|article|p|a|ul|ol|li|table|form|input|button|script|style|h[1-6])\b[^>]*>/i.test(text)) {
    return 'HTML'
  }
  if (/^<\?php\b/i.test(text)) return 'PHP'
  if (/^<\?xml\b/i.test(text) || /^<[a-z][\w-]*:[\w-]+/i.test(text)) return 'XML'
  if (/^#{1,6}\s+\S/m.test(text) && !/[;{}]/.test(text)) return 'Markdown'
  if (/^#!.*\b(bash|sh|zsh)\b/m.test(text)) return 'Shell'
  if (/^\s*(def|class)\s+\w+.*:\s*$/m.test(text) || /^\s*(from\s+\S+\s+import|import\s+\w+)\b/m.test(text) || /\bprint\s*\(/m.test(text)) {
    return 'Python'
  }
  if (/\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(TABLE|DATABASE|INDEX)|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(text)) {
    return 'SQL'
  }
  if (/^\s*package\s+\w+\s*$/m.test(text) || /\bfunc\s+\w+\s*\(/m.test(text)) return 'Go'
  if (/\bfn\s+\w+\s*\(/m.test(text) || /\blet\s+mut\b/.test(text) || /println!\s*\(/.test(text)) {
    return 'Rust'
  }
  if (/\b(public|private)\s+(static\s+)?(class|void|int|String)\b/.test(text) || /System\.out\.println/.test(text)) {
    return 'Java'
  }
  if (/#include\s*[<"]/.test(text) || /\b(int|void)\s+main\s*\(/.test(text)) return 'C'
  if (/^\s*(interface|type|enum)\s+\w+/m.test(text) || /:\s*(string|number|boolean|void|any)\b/.test(text)) {
    return 'TypeScript'
  }
  if (/\b(console\.(log|error|warn)|require|module\.exports)\s*[.(]/.test(text) || /\b(const|let|var)\s+\w+\s*=/.test(text) || /=>/.test(text) || /\bfunction\s+\w*\s*\(/.test(text)) {
    return 'JavaScript'
  }
  if (/^[.#]?[\w-]+(\s*[,>+~]\s*[.#]?[\w-]+)*\s*\{[^}]*\}/m.test(text)) return 'CSS'
  if (/^[\w-]+:\s+\S/m.test(text) && !/[{};]/.test(text)) return 'YAML'
  if (/\bputs\s+|^\s*end\s*$/m.test(text)) return 'Ruby'
  if (/^\s*(echo|sudo|apt-get|npm|yarn|pnpm|cd|ls|cat|mkdir|rm|git)\b/m.test(text)) return 'Shell'

  return ''
}

/** Splits a Markdown document into closed fenced code blocks. */
function parseBlocks(scriba, text) {
  var lines = text.split('\n')
  var starts = []
  var offset = 0
  var n

  for (n = 0; n < lines.length; n += 1) {
    starts.push(offset)
    offset += lines[n].length + 1
  }

  var blocks = []
  var i = 0

  while (i < lines.length) {
    var open = /^(\s*)(`{3,}|~{3,})([ \t]*)([^\s`]*)/.exec(lines[i])
    if (!open) {
      i += 1
      continue
    }

    var indent = open[1]
    var fence = open[2]
    var spaces = open[3]
    var rawTag = open[4] || ''
    var char = fence.charAt(0)
    var length = fence.length
    var declared = rawTag.toLowerCase()
    var body = []
    var j = i + 1
    var closed = false

    while (j < lines.length) {
      var close = /^\s*(`{3,}|~{3,})\s*$/.exec(lines[j])
      if (close && close[1].charAt(0) === char && close[1].length >= length) {
        closed = true
        break
      }
      body.push(lines[j])
      j += 1
    }

    if (!closed) break

    var code = body.join('\n')
    var tagFrom = starts[i] + indent.length + fence.length
    blocks.push({
      code: code,
      lang: languageFor(scriba, declared, code),
      declared: declared,
      tagFrom: tagFrom,
      tagTo: tagFrom + spaces.length + rawTag.length
    })
    i = j + 1
  }

  return blocks
}

function matchBlock(blocks, code, used) {
  for (var i = 0; i < blocks.length; i += 1) {
    if (used[i]) continue
    if (blocks[i].code === code) {
      used[i] = true
      return blocks[i]
    }
  }

  var trimmed = code.replace(/\s+$/, '')
  for (var k = 0; k < blocks.length; k += 1) {
    if (used[k]) continue
    if (blocks[k].code.replace(/\s+$/, '') === trimmed) {
      used[k] = true
      return blocks[k]
    }
  }

  return null
}

/** Collects the rendered lines of one code block starting at its first line. */
function collectGroup(first) {
  var lines = [first]
  var node = first
  var last = null

  while (true) {
    if (node.classList && node.classList.contains('cm-md-codeblock-last')) {
      last = node
      break
    }
    node = node.nextElementSibling
    if (!node || !node.classList || !node.classList.contains('cm-md-codeblock')) return null
    lines.push(node)
  }

  if (!last) return null

  var body = []
  for (var i = 1; i < lines.length - 1; i += 1) body.push(lines[i].textContent)
  return { code: body.join('\n') }
}

var api = null
var observer = null
var content = null
var timer = 0
var cachedText = null
var cachedBlocks = []
var menu = null
var menuBlock = null
var menuInput = null
var menuList = null

function clearLabels() {
  var labeled = document.querySelectorAll('[' + LANG_ATTR + ']')
  for (var i = 0; i < labeled.length; i += 1) labeled[i].removeAttribute(LANG_ATTR)
}

function ensureContent() {
  var next = document.querySelector('.cm-content')
  if (!next || next === content) return
  content = next
}

function apply() {
  if (!api) return
  ensureContent()
  if (!content) return

  var text = api.editor.getText()
  if (!text) {
    cachedText = null
    cachedBlocks = []
    clearLabels()
    return
  }

  if (text !== cachedText) {
    cachedText = text
    cachedBlocks = parseBlocks(api, text)
  }

  var used = []
  var firsts = content.querySelectorAll('.cm-line.cm-md-codeblock-first')
  for (var i = 0; i < firsts.length; i += 1) {
    var first = firsts[i]
    var group = collectGroup(first)
    if (!group) {
      first.removeAttribute(LANG_ATTR)
      continue
    }
    var block = matchBlock(cachedBlocks, group.code, used)
    if (!block || !block.lang) {
      first.removeAttribute(LANG_ATTR)
      continue
    }
    if (first.getAttribute(LANG_ATTR) !== block.lang) first.setAttribute(LANG_ATTR, block.lang)
  }
}

function schedule() {
  if (timer) return
  timer = setTimeout(function () {
    timer = 0
    apply()
  }, 16)
}

function labelForTag(tag) {
  if (!tag) return api.i18n.t('code-language-label.auto')
  if (tag === 'text') return textLabel(api)
  return ALIASES[tag] || prettify(tag)
}

function normalizeTag(value) {
  var raw = String(value || '').trim()
  if (!raw) return ''
  var autoLabel = api.i18n.t('code-language-label.auto').toLowerCase()
  if (raw.toLowerCase() === 'auto' || raw.toLowerCase() === autoLabel) return ''
  var tag = raw.toLowerCase().replace(/^`+|`+$/g, '').replace(/[\s`~]/g, '')
  if (!tag) return ''
  if (ALIASES[tag]) return tag
  for (var i = 0; i < CHOICES.length; i += 1) {
    if (CHOICES[i] && labelForTag(CHOICES[i]).toLowerCase() === raw.toLowerCase()) return CHOICES[i]
  }
  return tag
}

function findBlockForElement(target) {
  if (!api || !content) return null
  var text = api.editor.getText()
  if (text !== cachedText) {
    cachedText = text
    cachedBlocks = parseBlocks(api, text)
  }
  if (!cachedBlocks.length) return null

  var firsts = content.querySelectorAll('.cm-line.cm-md-codeblock-first')
  var used = []
  for (var i = 0; i < firsts.length; i += 1) {
    var group = collectGroup(firsts[i])
    if (!group) continue
    var block = matchBlock(cachedBlocks, group.code, used)
    if (block && firsts[i] === target) return block
  }
  return null
}

function chooseLanguage(tag) {
  var block = menuBlock
  closeMenu()
  if (!block || !api) return

  var replacement = tag ? ' ' + tag : ''
  if (typeof api.editor.replaceRange === 'function') {
    api.editor.replaceRange(block.tagFrom, block.tagTo, replacement)
  } else {
    var text = api.editor.getText()
    api.editor.setText(text.slice(0, block.tagFrom) + replacement + text.slice(block.tagTo))
  }
  if (api.editor.focus) api.editor.focus()
  schedule()
}

function buildItem(tag) {
  var item = document.createElement('button')
  item.type = 'button'
  item.className = 'scriba-code-lang-item'
  item.setAttribute('data-tag', tag)

  var name = document.createElement('span')
  name.className = 'scriba-code-lang-name'
  name.textContent = labelForTag(tag)
  item.appendChild(name)

  if (tag) {
    var code = document.createElement('span')
    code.className = 'scriba-code-lang-tag'
    code.textContent = tag
    item.appendChild(code)
  } else if (menuBlock && menuBlock.declared === '' && menuBlock.lang) {
    var detected = document.createElement('span')
    detected.className = 'scriba-code-lang-tag'
    detected.textContent = menuBlock.lang
    item.appendChild(detected)
  }

  if (menuBlock && menuBlock.declared === tag) {
    item.classList.add('is-current')
    var check = document.createElement('span')
    check.className = 'scriba-code-lang-check'
    check.textContent = '✓'
    item.appendChild(check)
  }

  item.addEventListener('mousedown', function (event) {
    event.preventDefault()
  })
  item.addEventListener('click', function () {
    chooseLanguage(tag)
  })
  return item
}

function renderChoices(filter) {
  if (!menuList) return
  menuList.textContent = ''

  var query = filter.trim().toLowerCase()
  var shown = 0
  for (var i = 0; i < CHOICES.length; i += 1) {
    var tag = CHOICES[i]
    var label = labelForTag(tag)
    if (query && tag.toLowerCase().indexOf(query) < 0 && label.toLowerCase().indexOf(query) < 0) continue
    menuList.appendChild(buildItem(tag))
    shown += 1
  }

  if (!shown && query) {
    var custom = document.createElement('button')
    custom.type = 'button'
    custom.className = 'scriba-code-lang-item is-custom'
    var customName = document.createElement('span')
    customName.className = 'scriba-code-lang-name'
    customName.textContent = filter.trim()
    custom.appendChild(customName)
    var hint = document.createElement('span')
    hint.className = 'scriba-code-lang-tag'
    hint.textContent = 'Enter'
    custom.appendChild(hint)
    custom.addEventListener('mousedown', function (event) {
      event.preventDefault()
    })
    custom.addEventListener('click', function () {
      chooseLanguage(normalizeTag(filter))
    })
    menuList.appendChild(custom)
  }
}

function closeMenu() {
  if (!menu) return
  var scroller = document.querySelector('.cm-scroller')
  if (scroller) scroller.removeEventListener('scroll', closeMenu)
  window.removeEventListener('resize', closeMenu)
  if (menu.parentNode) menu.parentNode.removeChild(menu)
  menu = null
  menuBlock = null
  menuInput = null
  menuList = null
}

function openMenu(block, x, y) {
  closeMenu()
  menuBlock = block

  menu = document.createElement('div')
  menu.className = 'scriba-code-lang-menu'
  menu.setAttribute('role', 'dialog')
  menu.style.left = x + 'px'
  menu.style.top = y + 'px'

  menuInput = document.createElement('input')
  menuInput.type = 'text'
  menuInput.className = 'scriba-code-lang-search'
  menuInput.placeholder = api.i18n.t('code-language-label.search')
  menuInput.spellcheck = false

  menuList = document.createElement('div')
  menuList.className = 'scriba-code-lang-list'

  menu.appendChild(menuInput)
  menu.appendChild(menuList)
  document.body.appendChild(menu)
  renderChoices('')

  var rect = menu.getBoundingClientRect()
  var left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))
  var top = Math.max(8, Math.min(y + 6, window.innerHeight - rect.height - 8))
  menu.style.left = left + 'px'
  menu.style.top = top + 'px'

  menuInput.addEventListener('input', function () {
    renderChoices(menuInput.value)
  })
  menuInput.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    var value = menuInput.value.trim()
    if (value) {
      chooseLanguage(normalizeTag(value))
      return
    }
    var first = menuList.querySelector('.scriba-code-lang-item')
    if (first) chooseLanguage(first.getAttribute('data-tag'))
  })
  menuInput.focus()

  var scroller = document.querySelector('.cm-scroller')
  if (scroller) scroller.addEventListener('scroll', closeMenu, { passive: true })
  window.addEventListener('resize', closeMenu)
}

function onDocumentMouseDown(event) {
  if (menu && !menu.contains(event.target)) closeMenu()
  if (!api || event.button !== 0) return

  var target = event.target
  if (!target || !target.closest) return
  var first = target.closest('.cm-line.cm-md-codeblock-first')
  if (!first || !first.hasAttribute(LANG_ATTR)) return

  var rect = first.getBoundingClientRect()
  if (event.clientY < rect.top - 2 || event.clientY > rect.top + 26) return

  var label = first.getAttribute(LANG_ATTR) || ''
  var badgeWidth = Math.min(160, Math.max(48, label.length * 7.5 + 18))
  if (event.clientX < rect.right - 18 - badgeWidth || event.clientX > rect.right - 4) return

  var block = findBlockForElement(first)
  if (!block) return

  event.preventDefault()
  event.stopPropagation()
  openMenu(block, event.clientX, event.clientY)
}

function onDocumentKeyDown(event) {
  if (!menu || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  closeMenu()
}

module.exports.activate = function activate(scriba) {
  api = scriba

  var languageIds = Object.keys(MESSAGES)
  for (var i = 0; i < languageIds.length; i += 1) {
    scriba.i18n.registerTranslations(languageIds[i], MESSAGES[languageIds[i]])
  }

  // A body-level observer covers both editor remounts (closing the last tab and
  // opening another document) and every re-render inside CodeMirror.
  observer = new MutationObserver(function () {
    ensureContent()
    schedule()
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  document.addEventListener('mousedown', onDocumentMouseDown, true)
  document.addEventListener('keydown', onDocumentKeyDown, true)

  scriba.events.on('doc:change', function () {
    if (menu) closeMenu()
    schedule()
  })
  scriba.events.on('file:open', schedule)
  scriba.events.on('editor:ready', schedule)
  scriba.events.on('workspace:change', schedule)
  scriba.i18n.onChange(function () {
    cachedText = null
    closeMenu()
    schedule()
  })

  schedule()
}

module.exports.deactivate = function deactivate() {
  closeMenu()
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
  document.removeEventListener('keydown', onDocumentKeyDown, true)
  if (observer) observer.disconnect()
  observer = null
  if (timer) clearTimeout(timer)
  timer = 0
  api = null
  content = null
  cachedText = null
  cachedBlocks = []
  clearLabels()
}
