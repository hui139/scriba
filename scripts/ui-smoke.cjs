/**
 * End-to-end UI smoke test.
 *
 * Drives the REAL built app (out/main + out/preload + out/renderer) with
 * `webContents.sendInputEvent`, which goes through Chromium's real input pipeline.
 * That makes it possible to verify clicks and typing without depending on the
 * desktop being visible or on mouse automation, which is unreliable on scaled
 * displays and when other windows overlap.
 *
 * Usage:
 *   npm run build
 *   node scripts/ui-smoke.cjs
 *
 * Exits non-zero when a check fails, so it can gate a release.
 */
const { app, BrowserWindow } = require('electron')
const { existsSync, mkdirSync, promises: fs, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const ROOT = join(__dirname, '..')
const WORKSPACE = join(tmpdir(), `scriba-ui-smoke-${Date.now()}`)
const USER_DATA = join(tmpdir(), `scriba-ui-smoke-data-${Date.now()}`)

const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`)
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function seedWorkspace() {
  mkdirSync(WORKSPACE, { recursive: true })
  await fs.writeFile(join(WORKSPACE, 'alpha.md'), '# Alpha\n\nneedle in alpha\n', 'utf8')
  await fs.writeFile(join(WORKSPACE, 'beta.md'), '# Beta\n\nneedle twice needle\n', 'utf8')
  await fs.writeFile(join(WORKSPACE, 'gamma.txt'), 'needle in text\n', 'utf8')
}

async function clickAt(wc, x, y) {
  await wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
  await wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
}

async function typeText(wc, text) {
  for (const ch of text) {
    await wc.sendInputEvent({ type: 'char', keyCode: ch })
    await wait(60)
  }
}

async function run() {
  await seedWorkspace()

  // `registerSchemesAsPrivileged` in the main bundle must run before the app is
  // ready, so the entry point is loaded at module scope (below), not here.
  await wait(1500)
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) {
    record('window created', false)
    return
  }
  record('window created', true)

  const wc = win.webContents
  const rendererErrors = []
  wc.on('console-message', (_event, level, message) => {
    if (level >= 2) rendererErrors.push(String(message).slice(0, 160))
  })

  await wait(3000)
  record(
    'app mounted',
    await wc.executeJavaScript("document.getElementById('root').children.length > 0")
  )

  const tabs = await wc.executeJavaScript(
    "Array.prototype.map.call(document.querySelectorAll('.sidebar-tab'), function (t) { return t.textContent.trim() })"
  )
  // Three fixed tabs. The plugin-panel tab only appears once a plugin registers a panel,
  // and no built-in plugin does, so four tabs here would mean the empty tab came back.
  record('sidebar tabs render', tabs.length === 3, JSON.stringify(tabs))

  // Open the workspace the way the menu does.
  wc.send('app:open-folder-path', WORKSPACE)
  await wait(1200)
  record(
    'workspace opened',
    await wc.executeJavaScript("!!document.querySelector('.tree, .tree-search-input')")
  )

  // Switch to the search tab by locating it rather than guessing coordinates.
  const tab = await wc.executeJavaScript(`(function () {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.sidebar-tab'));
    var boxes = tabs.map(function (t) {
      var b = t.getBoundingClientRect();
      return t.textContent.trim() + '|x=' + Math.round(b.x) + ',y=' + Math.round(b.y) +
        ',w=' + Math.round(b.width) + ',h=' + Math.round(b.height);
    });
    var found = tabs.find(function (t) { return t.textContent.indexOf('\u641c') >= 0; });
    if (!found) return { boxes: boxes, found: false };
    var r = found.getBoundingClientRect();
    return {
      found: true,
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      boxes: boxes
    };
  })()`)
  console.log('TAB_BOXES=' + JSON.stringify(tab && tab.boxes))
  if (!tab || !tab.found) {
    record('search tab found', false)
    return
  }
  // The click is only delivered once the window is actually shown and focused;
  // an offscreen window drops synthetic input, so wait for visibility first.
  if (!win.isVisible()) win.show()
  await wait(400)
  await clickAt(wc, tab.x, tab.y)
  await wait(1500)
  const activeIdx = await wc.executeJavaScript(
    "Array.prototype.findIndex.call(document.querySelectorAll('.sidebar-tab'), function (t) { return t.classList.contains('active') })"
  )
  record(
    'search tab activates',
    await wc.executeJavaScript("!!document.querySelector('.search-panel')"),
    'activeIndex=' + activeIdx + ' boxes=' + JSON.stringify(tab && tab.boxes)
  )

  // Type a query through real key events.
  const input = await wc.executeJavaScript(`(function () {
    var el = document.querySelector('.search-panel input');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.x + 20), y: Math.round(r.y + r.height / 2) };
  })()`)
  if (!input) {
    record('search input found', false)
    return
  }
  await clickAt(wc, input.x, input.y)
  await wait(200)
  await typeText(wc, 'needle')
  await wait(1200)

  const typed = await wc.executeJavaScript("document.querySelector('.search-panel input').value")
  record('typing reaches the input', typed === 'needle', typed)

  const fileCount = await wc.executeJavaScript("document.querySelectorAll('.search-file').length")
  record('search returns results', fileCount === 3, `files=${fileCount}`)

  // --- Shortcut customization ---
  // Switch back to the Files tab: the search panel replaced the file tree there.
  const filesTab = await wc.executeJavaScript(`(function () {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.sidebar-tab'));
    var found = tabs.find(function (t) { return t.textContent.indexOf('\\u6587\\u4ef6') >= 0; });
    if (!found) return null;
    var r = found.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`)
  if (filesTab) {
    await clickAt(wc, filesTab.x, filesTab.y)
    await wait(600)
  }

  // Open a document first: the rebind is verified against a real editor afterwards,
  // and the settings modal covers the sidebar while it is open.
  const opened = await wc.executeJavaScript(`(function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('.tree-row'));
    var file = rows.find(function (r) {
      var name = (r.querySelector('.tree-name') || {}).textContent || '';
      return name.endsWith('.md');
    });
    if (!file) return null;
    var r = file.getBoundingClientRect();
    return { x: Math.round(r.x + 40), y: Math.round(r.y + r.height / 2) };
  })()`)
  if (opened) {
    await clickAt(wc, opened.x, opened.y)
    await wait(1400)
  }
  record(
    'document opened from tree',
    await wc.executeJavaScript("!!document.querySelector('.cm-content')"),
    'tabs=' + (await wc.executeJavaScript("document.querySelectorAll('.tab').length"))
  )

  // Open Settings, go to the Shortcuts section, and confirm every command is listed
  // with its current binding.
  await wc.executeJavaScript(
    "document.querySelector('.titlebar button[title*=\"ettings\"], .titlebar button[title*=\"设置\"]')?.click()"
  )
  await wait(600)
  const settingsOpen = await wc.executeJavaScript("!!document.querySelector('.settings-modal')")
  record('settings opens', settingsOpen)

  if (settingsOpen) {
    // Click the Shortcuts nav item by matching its label text.
    const nav = await wc.executeJavaScript(`(function () {
      var items = Array.prototype.slice.call(document.querySelectorAll('.settings-nav-item'));
      var found = items.find(function (el) {
        return el.textContent.indexOf('\\u5feb\\u6377\\u952e') >= 0 || /shortcut/i.test(el.textContent);
      });
      if (!found) return null;
      var r = found.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()`)
    if (nav) {
      await clickAt(wc, nav.x, nav.y)
      await wait(500)
    }

    const rows = await wc.executeJavaScript("document.querySelectorAll('.shortcut-row').length")
    record('shortcut list renders', rows >= 40, `rows=${rows}`)

    // The About page must no longer repeat a static shortcut list; shortcuts live
    // only in their own section now.
    const aboutNav = await wc.executeJavaScript(`(function () {
      var items = Array.prototype.slice.call(document.querySelectorAll('.settings-nav-item'));
      var found = items.find(function (el) {
        return el.textContent.indexOf('\\u5173\\u4e8e') >= 0 || /about/i.test(el.textContent);
      });
      if (!found) return null;
      var r = found.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()`)
    if (aboutNav) {
      await clickAt(wc, aboutNav.x, aboutNav.y)
      await wait(400)
      const about = await wc.executeJavaScript(`(function () {
        var section = document.querySelector('.settings-section');
        return {
          hasShortcutGrid: !!document.querySelector('.shortcut-grid'),
          hasKbd: document.querySelectorAll('.settings-section kbd').length,
          text: (section ? section.textContent : '').slice(0, 80)
        };
      })()`)
      record(
        'about page has no shortcut list',
        !about.hasShortcutGrid && about.hasKbd === 0,
        JSON.stringify(about)
      )
      // Return to the shortcuts section for the remaining checks.
      if (nav) {
        await clickAt(wc, nav.x, nav.y)
        await wait(400)
      }
    }

    const firstKey = await wc.executeJavaScript(
      "(document.querySelector('.shortcut-key')||{}).textContent || ''"
    )
    record('binding is displayed', /Ctrl|⌘/.test(firstKey), firstKey)

    // Rebind the first command to a distinctive combo through the real UI.
    const keyBox = await wc.executeJavaScript(`(function () {
      var el = document.querySelector('.shortcut-key');
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()`)
    if (keyBox) {
      await clickAt(wc, keyBox.x, keyBox.y)
      await wait(300)
      const recording = await wc.executeJavaScript(
        "!!document.querySelector('.shortcut-key.recording')"
      )
      record('click starts recording', recording)

      // A single keyDown carrying the modifiers is enough; sending bare modifier
      // presses first only confuses the recorder.
      await wc.sendInputEvent({ type: 'keyDown', keyCode: 'J', modifiers: ['control', 'alt'] })
      await wait(600)

      const rebound = await wc.executeJavaScript(
        "(document.querySelector('.shortcut-key')||{}).textContent || ''"
      )
      record('rebind captured', /J/.test(rebound) && /Alt/.test(rebound), rebound)

      // The rebind must actually drive the editor, not just change the label.
      // The document was opened before Settings; just close the modal.
      await wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      await wait(500)
      const stillOpen = await wc.executeJavaScript("!!document.querySelector('.settings-modal')")
      if (stillOpen) {
        await wc.executeJavaScript(
          "document.querySelector('.settings-modal .modal-header .icon-btn')?.click()"
        )
        await wait(500)
      }

      const editor = await wc.executeJavaScript(`(function () {
        var el = document.querySelector('.cm-content');
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return { x: Math.round(r.x + 40), y: Math.round(r.y + 30) };
      })()`)
      record('editor found for rebind test', editor !== null, JSON.stringify(editor))
      if (editor) {
        await clickAt(wc, editor.x, editor.y)
        await wait(300)
        // Select the whole first line, then apply bold via the new shortcut.
        await wc.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] })
        await wait(200)
        await wc.sendInputEvent({ type: 'keyDown', keyCode: 'J', modifiers: ['control', 'alt'] })
        await wait(600)
        const applied = await wc.executeJavaScript(`(function () {
          var text = (document.querySelector('.cm-content') || {}).textContent || '';
          var hasStrong = document.querySelectorAll('.cm-content strong').length > 0;
          var hasMarkup = text.indexOf('**') >= 0;
          return JSON.stringify({ hasStrong: hasStrong, hasMarkup: hasMarkup, sample: text.slice(0, 40) });
        })()`)
        record('rebound shortcut applies bold', /"hasStrong":true|"hasMarkup":true/.test(applied), applied)
      }
    }
  }

  // --- Marketplace tab ---
  // The index URL points at a host that does not exist here, so the panel must show
  // an error rather than crash; the important part is that the tab renders.
  await wc.executeJavaScript(
    "document.querySelector('.titlebar button[title*=\"\u63d2\u4ef6\"], .titlebar button[title*=lugin]')?.click()"
  )
  await wait(700)
  const managerOpen = await wc.executeJavaScript("!!document.querySelector('.modal')")
  record('plugin manager opens', managerOpen)

  if (managerOpen) {
    const marketTab = await wc.executeJavaScript(`(function () {
      var tabs = Array.prototype.slice.call(document.querySelectorAll('.modal .sidebar-tab'));
      var found = tabs.find(function (t) { return /\u6d4f\u89c8|browse/i.test(t.textContent); });
      if (!found) return null;
      var r = found.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()`)
    if (marketTab) {
      await clickAt(wc, marketTab.x, marketTab.y)
      await wait(2500)
    }
    const market = await wc.executeJavaScript(`(function () {
      var input = document.querySelector('.marketplace-toolbar .tree-search-input');
      return {
        hasPanel: !!document.querySelector('.marketplace'),
        hasToolbar: !!document.querySelector('.marketplace-toolbar'),
        hasSearchInput: !!input,
        placeholder: input ? input.placeholder : '',
        hasError: !!document.querySelector('.marketplace .pwarn'),
        text: (document.querySelector('.marketplace') || {}).textContent?.slice(0, 80) || ''
      };
    })()`)
    record(
      'marketplace panel renders',
      market.hasPanel && market.hasToolbar && market.hasSearchInput,
      JSON.stringify(market)
    )
    await wc.executeJavaScript(
      "document.querySelector('.modal-header .icon-btn')?.click()"
    )
    await wait(400)
  }

  record('no renderer errors', rendererErrors.length === 0, JSON.stringify(rendererErrors.slice(0, 3)))
}

app.setPath('userData', USER_DATA)
// Load the app entry point at module scope: it calls `registerSchemesAsPrivileged`,
// which Electron requires to happen before the app becomes ready.
require(join(ROOT, 'out', 'main', 'index.js'))

app.whenReady().then(async () => {
  try {
    await run()
  } catch (error) {
    record('unexpected error', false, String(error && error.message))
  } finally {
    const failed = results.filter((r) => !r.ok)
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
    await fs.rm(WORKSPACE, { recursive: true, force: true }).catch(() => {})
    await fs.rm(USER_DATA, { recursive: true, force: true }).catch(() => {})
    app.exit(failed.length === 0 ? 0 : 1)
  }
})
