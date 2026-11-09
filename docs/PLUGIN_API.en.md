# Scriba Plugin & API Documentation

[简体中文](PLUGIN_API.md) · English

> Applies to: Scriba 0.1.0+  
> API version: released with the app. New capabilities remain backward compatible; removals or breaking changes bump the major version.

---

## Contents

1. [Overview](#1-overview)
2. [Quick start](#2-quick-start)
3. [Plugin directory and manifest](#3-plugin-directory-and-manifest)
4. [Lifecycle and module format](#4-lifecycle-and-module-format)
5. [API reference](#5-api-reference)
6. [Examples](#6-examples)
7. [Debugging](#7-debugging)
8. [Packaging and publishing](#8-packaging-and-publishing)
9. [Security](#9-security)
10. [Compatibility and best practices](#10-compatibility-and-best-practices)
11. [Related documentation](#11-related-documentation)

---

## 1. Overview

A Scriba plugin is ordinary JavaScript running in the editor's renderer process. A plugin is a folder containing a manifest and an entry script; it may also include a `style.css`, which the app injects automatically after the plugin is enabled.

Plugins can extend the following:

- Commands and keyboard shortcuts
- Status bar items and sidebar panels
- Custom code block renderers
- Themes
- Interface languages and translations
- Events for file open, file save, document change, editor ready, and workspace change
- Editor read/write, isolated storage, KaTeX, and Mermaid

> **Security note**: plugins run with the same privileges as the app and can access the DOM, the network, and `localStorage`. Only install plugins from trusted sources.

### 1.1 Audience

- Plugin authors who want to add features to Scriba
- Teams maintaining internal or private plugins and marketplaces
- Contributors who want to understand how plugins run and where the API boundaries are

### 1.2 Design principles

- **Explicit registration**: every contribution is registered through the `scriba` object, and the runtime removes it when the plugin is disabled.
- **Minimal privilege surface**: the renderer never touches Node.js directly; plugins operate on the editor and UI through public APIs.
- **No `eval`**: plugin entry points are executed as Blob modules, compatible with a CSP that does not allow `unsafe-eval`.
- **Cleanup-friendly**: event subscriptions and contributions are removed automatically; timers, DOM listeners, and similar resources should be cleaned up in `deactivate`.

---

## 2. Quick start

### 2.1 Minimal plugin

Create a folder `my-plugin/`:

```
my-plugin/
├─ manifest.json
└─ index.js
```

`manifest.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A minimal Scriba plugin",
  "author": "Your Name",
  "license": "MIT",
  "main": "index.js",
  "minAppVersion": "0.1.0"
}
```

`index.js`:

```js
module.exports.activate = function activate(scriba) {
  scriba.commands.register({
    id: 'my-plugin.hello',
    name: 'Say Hello',
    run: () => scriba.ui.showToast('Hello from my plugin!')
  })
}
```

### 2.2 Install and enable

1. Open **Plugins → Plugin Manager**.
2. Click **Install from folder** and select `my-plugin/`.
3. The plugin appears under **Installed** and is enabled by default.
4. After changing the code, click **Reload** to apply the changes.

You can also place the plugin folder directly in `<userData>/plugins/<plugin-id>/` and reload.

### 2.3 Verify

- Open the command palette (`Ctrl/Cmd + P`) and search for "Say Hello".
- Running the command should show a toast prefixed with the plugin name.
- If nothing appears, open DevTools (`Ctrl/Cmd + Shift + I`) and check the console for errors.

---

## 3. Plugin directory and manifest

### 3.1 Directory layout

```
my-plugin/
├─ manifest.json      # required
├─ index.js           # entry, may be overridden by manifest.main
├─ style.css          # optional, injected after successful activation
└─ README.md          # optional, usage notes
```

Plugin locations:

- User plugins: `<userData>/plugins/<plugin-id>/`
- Built-in plugins: `plugins/<plugin-id>/` in the app directory

If a user plugin and a built-in plugin share the same `id`, **the built-in plugin wins** and the user plugin does not override it.

### 3.2 `manifest.json`

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "Your Name",
  "license": "MIT",
  "homepage": "https://github.com/you/my-plugin",
  "main": "index.js",
  "minAppVersion": "0.1.0",
  "keywords": ["statusbar", "productivity"]
}
```

| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | Unique identifier; lowercase letters and hyphens recommended. See [PLUGIN_SPEC.md](PLUGIN_SPEC.md) for naming rules |
| `name` | Yes | Display name |
| `version` | Yes | Semantic version, e.g. `1.0.0` |
| `description` | No | Shown in the plugin manager |
| `author` | No | Author |
| `license` | No | SPDX identifier, e.g. `MIT` |
| `homepage` | No | Repository or documentation URL |
| `main` | No | Entry file name; defaults to `index.js` |
| `minAppVersion` | No | Minimum required app version |
| `keywords` | No | Search keywords |

### 3.3 Version compatibility

`minAppVersion` is compared with the running app version segment by segment. When the app is older:

- The plugin is still listed and shows a "requires vX.Y.Z+" hint.
- Plugins should detect optional APIs in `activate` instead of assuming they exist.

```js
module.exports.activate = function activate(scriba) {
  if (typeof scriba.editor.replaceRange === 'function') {
    // Use the newer API
  } else {
    // Fall back to an older implementation
  }
}
```

### 3.4 Naming and publishing rules

See [PLUGIN_SPEC.md](PLUGIN_SPEC.md) for the full specification of plugin ids, repository names, versions, and publishing. Summary:

- `id`: 3–64 characters, lowercase letters, digits, and hyphens; must start and end with a letter or digit; no consecutive hyphens; reserved words such as `core`, `scriba`, and `plugin` are rejected.
- Version: must be a semantic version (`major.minor.patch`, optionally with a prerelease suffix).
- Repository name: `scriba-plugin-<id>` is recommended. Add the `scriba-plugin` topic to a public GitHub repository to make it discoverable in the marketplace.

---

## 4. Lifecycle and module format

### 4.1 `activate` and `deactivate`

The entry uses CommonJS style and must export `activate`:

```js
module.exports.activate = function activate(scriba) {
  // Register contributions
}

module.exports.deactivate = function deactivate() {
  // Optional: clean up timers, DOM listeners, etc.
}
```

- `activate` may be `async`; the runtime waits for it to finish.
- It is called on app startup, when the plugin is enabled, and when the plugin is reloaded.
- When a plugin is disabled or reloaded, the runtime calls `deactivate` and then removes all contributions registered by the plugin.
- `deactivate` should be **synchronous**; the runtime does not wait for asynchronous cleanup.

> **Important**: `deactivate` must be assigned at **module scope**, not inside `activate`. The runtime reads `module.exports.deactivate` when the module is evaluated, before `activate` is called; assigning it inside `activate` will not be captured.

### 4.2 Module format

The entry source is wrapped in a CommonJS compatibility shim and executed as an ES module. Therefore:

- **`import` / `export` syntax is not supported**.
- Use `module.exports.activate = ...` or plain script style.
- The wrapper enables strict mode (`"use strict"`).
- `scriba` is passed as a parameter; it is not a global.
- Standard browser APIs are available (`document`, `window`, `localStorage`, `fetch`, etc.).

### 4.3 Error handling

- Errors thrown by `activate` are caught; activation is aborted and a toast is shown, without affecting other plugins.
- The console prints `[scriba] failed to activate plugin "<id>"` and the error details.
- Errors thrown by `deactivate` are logged but do not block cleanup of other plugins.
- Use `Ctrl/Cmd + Shift + I` to open DevTools while debugging.

### 4.4 Automatic cleanup

The runtime automatically cleans up:

- Commands registered with `scriba.commands.register`
- Keybindings registered with `scriba.commands.registerKeybinding`
- UI items added with `scriba.ui.addStatusBarItem` / `addSidebarPanel`
- Themes registered with `scriba.themes.register`
- Renderers registered with `scriba.markdown.registerCodeBlockRenderer`
- Event listeners registered with `scriba.events.on`
- Languages and translations registered with `scriba.i18n.registerLanguage` / `registerTranslations`
- The injected `style.css`

Resources **not** cleaned up automatically include `setTimeout` / `setInterval`, `document.addEventListener`, `window.addEventListener`, `MutationObserver`, WebSocket, long-polling `fetch`, and similar. Clean them up in `deactivate`.

---

## 5. API reference

The object passed to `activate(scriba)` contains:

| Member | Purpose |
| --- | --- |
| `scriba.manifest` | Manifest information for the current plugin |
| `scriba.editor` | Editor read/write and cursor operations |
| `scriba.commands` | Commands and keybindings |
| `scriba.ui` | Status bar, sidebar, and toasts |
| `scriba.markdown` | Custom code block renderers |
| `scriba.themes` | Theme registration |
| `scriba.events` | App event subscriptions |
| `scriba.i18n` | Translation, language registration, and switching |
| `scriba.storage` | Plugin-isolated persistent storage |
| `scriba.libs` | Built-in third-party libraries (KaTeX, Mermaid) |
| `scriba.log` | Logging with a plugin prefix |

### 5.1 `scriba.manifest`

```ts
{
  id: string
  name: string
  version: string
  description?: string
  author?: string
  minAppVersion?: string
  homepage?: string
  keywords?: string[]
}
```

A read-only object. `license` and `main` are not part of the runtime manifest object; read `manifest.json` or store them yourself if needed.

### 5.2 `scriba.editor`

Editor operations. All methods are safe no-ops when there is no active document; getters return an empty string or default values.

```ts
getText(): string
setText(text: string): void
getSelection(): string
replaceSelection(text: string): void
insertText(text: string): void
wrapSelection(before: string, after?: string): void
getCursor(): { line: number; col: number }
scrollToLine(line: number): void
focus(): void
replaceRange(from: number, to: number, text: string): void
```

| Method | Description |
| --- | --- |
| `getText()` | Returns the full document; `''` when there is no document |
| `setText(text)` | Replaces the entire document |
| `getSelection()` | Returns the selected text; `''` when there is no selection |
| `replaceSelection(text)` | Replaces the selection and moves the cursor to the end of the inserted text; focuses the editor |
| `insertText(text)` | Inserts text at the cursor and moves the cursor to the end; focuses the editor |
| `wrapSelection(before, after?)` | Wraps the selection; `after` defaults to `before`; focuses the editor |
| `getCursor()` | Returns 1-based `{ line, col }`; returns `{ line: 1, col: 1 }` when there is no document |
| `scrollToLine(line)` | Moves the cursor to the start of the line, centers it, and focuses the editor; the line number is clamped |
| `focus()` | Focuses the editor |
| `replaceRange(from, to, text)` | Replaces text between two **0-based character offsets**; offsets are clamped to the document; keeps the selection mapped; does not focus |

Example: insert today's date at the cursor

```js
scriba.commands.register({
  id: 'my-plugin.insertDate',
  name: 'Insert today',
  run: () => scriba.editor.insertText(new Date().toISOString().slice(0, 10))
})
```

Example: replace the first occurrence of a string

```js
const text = scriba.editor.getText()
const index = text.indexOf('TODO')
if (index >= 0) {
  scriba.editor.replaceRange(index, index + 4, 'DONE')
}
```

### 5.3 `scriba.commands`

```ts
register({
  id: string,          // prefix with the plugin id, e.g. "my-plugin.hello"
  name: string,        // shown in the command palette
  nameKey?: string,    // optional i18n key, preferred over name
  hint?: string,       // shortcut hint text
  run: () => void | Promise<void>
}): void

execute(id: string): Promise<void>
list(): string[]                       // all currently registered command ids
registerKeybinding({ command, combo }): void
```

| Method | Description |
| --- | --- |
| `register(command)` | Registers a command; duplicate `id` logs a warning and ignores the later registration |
| `execute(id)` | Runs a command; unknown ids log a warning and resolve |
| `list()` | Returns all registered command ids, including core and other plugins' commands |
| `registerKeybinding({ command, combo })` | Binds a shortcut to one of this plugin's own commands |

#### Binding a shortcut

```js
scriba.commands.registerKeybinding({
  command: 'my-plugin.insertDate',
  combo: 'mod+alt+d'
})
```

Combo format (`mod` is Ctrl on Windows/Linux and ⌘ on macOS):

| Combo | Meaning |
| --- | --- |
| `mod+b` | Ctrl/⌘ + B |
| `mod+shift+x` | Ctrl/⌘ + Shift + X |
| `mod+alt+p` | Ctrl/⌘ + Alt + P |
| `f8` | F8 |
| `mod+1` | Ctrl/⌘ + 1 |

Rules:

- You can only bind shortcuts to commands **registered by your own plugin**; binding another plugin's command is rejected with a warning.
- Binding a non-existent command is ignored with a warning.
- User-assigned shortcuts for core commands take precedence over plugin bindings; plugin commands themselves are not listed in **Settings → Shortcuts**.
- If the same command is bound multiple times, the later registration wins.

### 5.4 `scriba.ui`

```ts
addStatusBarItem({
  id: string,
  element: HTMLElement,
  order?: number       // lower is further left; defaults to 100
}): void

addSidebarPanel({
  id: string,
  title: string,
  render: () => HTMLElement   // called when the UI renders the panel
}): void

showToast(message: string, type?: 'info' | 'error' | 'success'): void
```

| Method | Description |
| --- | --- |
| `addStatusBarItem(item)` | Adds an element to the status bar; items are sorted by `order`; duplicate `id` overwrites |
| `addSidebarPanel(panel)` | Adds a panel to the sidebar's **Plugins** view; `render` returns the element to mount; duplicate `id` overwrites |
| `showToast(message, type?)` | Shows a toast; the message is prefixed with `[Plugin Name]` |

Plugins create and update status bar and sidebar elements themselves. The sidebar may call `render` multiple times when the panel registry changes; return a cached element to avoid recreating it and losing state.

#### Following the interface scale

Settings has an **Interface scale** control that resizes the sidebar, menus and dialogs between 85% and 140%. The core interface implements this with a CSS variable:

```css
font-size: calc(12px * var(--ui-scale));
```

`--ui-scale` is a global CSS variable; `1` means 100%. **UI that a plugin creates does not follow the scale by default**, because the sizes come from the plugin's own CSS. To support it, write sizes the same way:

```js
const label = document.createElement('div')
label.textContent = 'Hello'
// Recommended: follows the interface scale
label.style.fontSize = 'calc(12px * var(--ui-scale))'
// Not recommended: stays fixed and looks too small once the user enlarges the interface
// label.style.fontSize = '12px'
```

A plugin can use `var(--ui-scale)` in its own `<style>` or in an element's `style` directly; no API call is needed. If a plugin needs fixed pixels (for example to align graphics), keep the literal value — that is a valid choice.

Example: show the current time in the status bar

```js
let timer = 0
let item = null

module.exports.activate = function activate(scriba) {
  item = document.createElement('span')
  // Follows the interface scale, so it grows with the rest of the UI.
  item.style.fontSize = 'calc(12px * var(--ui-scale))'
  const update = () => {
    if (item) item.textContent = new Date().toLocaleTimeString()
  }
  update()
  scriba.ui.addStatusBarItem({ id: 'my-plugin.clock', element: item, order: 20 })
  timer = setInterval(update, 1000)
}

// Must be assigned at module scope so the runtime can capture it.
module.exports.deactivate = function deactivate() {
  clearInterval(timer)
  timer = 0
  item = null
}
```

### 5.5 `scriba.markdown`

Registers a renderer for a custom code block language. When the cursor is outside the block, the code block is replaced by the rendered result; when the cursor enters the block, the source is shown again.

```ts
registerCodeBlockRenderer(
  language: string,
  renderer: (code: string, element: HTMLElement) => void | Promise<void>
): void

getCodeBlockRenderer(language: string): CodeBlockRenderer | undefined
```

| Method | Description |
| --- | --- |
| `registerCodeBlockRenderer(language, renderer)` | Registers a renderer; `language` is lowercased; a later registration for the same language wins |
| `getCodeBlockRenderer(language)` | Looks up a renderer case-insensitively |

Behavior:

- The renderer runs only when the **cursor is outside the code block**.
- The passed `element` is a fresh container; the renderer fills it.
- Synchronous exceptions are caught and displayed as error text.
- If the renderer returns a Promise, the app does not await or catch asynchronous errors; handle them yourself.

Example:

```js
scriba.markdown.registerCodeBlockRenderer('plantuml', async (code, el) => {
  el.textContent = 'Rendering…'
  try {
    // Call an external service or a local library here
    el.textContent = code.toUpperCase()
  } catch (error) {
    el.textContent = String(error)
  }
})
```

### 5.6 `scriba.themes`

```ts
register({ id: string, name: string, css: string }): void
```

Registered themes appear in the theme list. The `css` is injected into the page; scope it with `:root[data-theme="your-id"]` to avoid affecting other themes:

```css
:root[data-theme="my-theme"] {
  --bg: #101418;
  --bg-sidebar: #0b0f12;
  --bg-elevated: #161b20;
  --bg-hover: #1d242b;
  --bg-active: #242d35;
  --border: #263039;
  --text: #dbe4ec;
  --text-secondary: #a7b4c0;
  --text-muted: #6b7a88;
  --accent: #4ea1ff;
  --accent-soft: rgba(78, 161, 255, 0.15);
  --selection: rgba(78, 161, 255, 0.25);
  --code-bg: #1a2128;
  --code-text: #ff9ec4;
  --quote-border: #2e3a45;
}
```

Duplicate `id` overwrites an existing theme. Plugin themes appear alongside built-in and user themes; the selected theme id is stored in settings.

### 5.7 `scriba.events`

```ts
on(event: 'file:open' | 'file:save' | 'doc:change' | 'editor:ready' | 'workspace:change',
   cb: (payload?: unknown) => void): () => void
```

Returns an unsubscribe function. The runtime also unsubscribes listeners registered through this API when the plugin is unloaded.

| Event | Payload | When it fires |
| --- | --- | --- |
| `file:open` | Absolute file path | After a file is opened |
| `file:save` | Absolute file path | After a file is saved |
| `workspace:change` | Workspace root path | After a workspace is opened or changed |
| `editor:ready` | None | After the editor instance is ready |
| `doc:change` | Full document text | When document content changes (may be very frequent) |

Debounce expensive work in `doc:change`, for example:

```js
let timer = 0
scriba.events.on('doc:change', () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    // Process the latest text
  }, 150)
})
```

### 5.8 `scriba.i18n`

```ts
t(key: string, vars?: Record<string, string | number>): string
getLanguage(): string
setLanguage(id: string): void
getLanguages(): Array<{ id: string; name: string }>
registerLanguage(language: {
  id: string
  name: string
  translations: Record<string, string>
}): void
registerTranslations(languageId: string, translations: Record<string, string>): void
onChange(cb: (language: string) => void): () => void
```

| Method | Description |
| --- | --- |
| `t(key, vars?)` | Translates using the current language; supports `{name}` placeholders; returns the key when missing |
| `getLanguage()` | Returns the current language id, e.g. `zh-CN`, `en-US` |
| `setLanguage(id)` | Switches the interface language |
| `getLanguages()` | Returns the available languages |
| `registerLanguage(language)` | Registers a new language; an existing id is not overwritten |
| `registerTranslations(languageId, translations)` | Merges plugin strings into an existing language |
| `onChange(cb)` | Calls back when the language changes; returns an unsubscribe function |

Example: provide English and Chinese strings for a plugin

```js
scriba.i18n.registerTranslations('zh-CN', {
  'my-plugin.greeting': '你好，{name}'
})
scriba.i18n.registerTranslations('en-US', {
  'my-plugin.greeting': 'Hello, {name}'
})

scriba.commands.register({
  id: 'my-plugin.greet',
  name: 'Greet',
  run: () => scriba.ui.showToast(scriba.i18n.t('my-plugin.greeting', { name: 'Scriba' }))
})
```

### 5.9 `scriba.storage`

Plugin-isolated persistent storage (`localStorage`, with keys prefixed by `scriba-plugin:<plugin-id>:`).

```ts
get<T>(key: string): T | undefined
set(key: string, value: unknown): void
delete(key: string): void
```

- Values are serialized with `JSON.stringify` / `JSON.parse`; they must be JSON-serializable.
- Missing or unparsable values return `undefined`.
- Storage is isolated per plugin, so the same key in different plugins does not collide.

### 5.10 `scriba.libs`

Reuse libraries bundled with the app to avoid shipping duplicates:

```ts
scriba.libs.katex.renderToString('x^2')

const mermaid = await scriba.libs.mermaid()
```

| Member | Description |
| --- | --- |
| `libs.katex` | KaTeX default export; call `renderToString` and other APIs directly |
| `libs.mermaid()` | Asynchronously returns the Mermaid default export; loaded on first call |

### 5.11 `scriba.log`

Logging with a plugin prefix:

```js
scriba.log('loaded', { version: '1.0.0' })
// Console output: [plugin:my-plugin] loaded { version: '1.0.0' }
```

---

## 6. Examples

### 6.1 Command + shortcut

```js
module.exports.activate = function activate(scriba) {
  scriba.commands.register({
    id: 'my-plugin.insertDate',
    name: 'Insert today',
    nameKey: 'my-plugin.insertDate',
    hint: 'Ctrl+Alt+D',
    run: () => scriba.editor.insertText(new Date().toISOString().slice(0, 10))
  })

  scriba.commands.registerKeybinding({
    command: 'my-plugin.insertDate',
    combo: 'mod+alt+d'
  })
}
```

### 6.2 Status bar word count

`manifest.json`:

```json
{
  "id": "word-count",
  "name": "Word Count",
  "version": "1.0.0",
  "main": "index.js",
  "minAppVersion": "0.1.0"
}
```

`index.js`:

```js
let item = null

function update(scriba) {
  const text = scriba.editor.getText()
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  if (item) item.textContent = words + ' words'
}

module.exports.activate = function activate(scriba) {
  item = document.createElement('span')
  scriba.ui.addStatusBarItem({ id: 'word-count.item', element: item, order: 10 })
  update(scriba)
  scriba.events.on('doc:change', () => update(scriba))
}

module.exports.deactivate = function deactivate() {
  item = null
}
```

### 6.3 Sidebar panel

```js
module.exports.activate = function activate(scriba) {
  const el = document.createElement('div')
  const button = document.createElement('button')
  button.textContent = 'Insert today'
  button.onclick = () => {
    scriba.editor.insertText(new Date().toISOString().slice(0, 10))
  }
  el.appendChild(button)

  scriba.ui.addSidebarPanel({
    id: 'daily.panel',
    title: 'Daily',
    render: () => el
  })
}
```

### 6.4 Custom code block renderer

```js
module.exports.activate = function activate(scriba) {
  scriba.markdown.registerCodeBlockRenderer('plantuml', async (code, el) => {
    el.textContent = 'Rendering…'
    try {
      const response = await fetch('https://example.com/render', {
        method: 'POST',
        body: code
      })
      el.textContent = await response.text()
    } catch (error) {
      el.textContent = String(error)
    }
  })
}
```

### 6.5 Theme

```js
module.exports.activate = function activate(scriba) {
  scriba.themes.register({
    id: 'ocean',
    name: 'Ocean',
    css: `
      :root[data-theme="ocean"] {
        --bg: #0b1a24;
        --bg-sidebar: #07131b;
        --bg-elevated: #102430;
        --text: #d7ecf5;
        --text-secondary: #9fc3d3;
        --accent: #4fd1c5;
        --accent-soft: rgba(79, 209, 197, 0.16);
      }
    `
  })
}
```

### 6.6 Internationalization

```js
const messages = {
  'zh-CN': {
    'my-plugin.title': '我的插件',
    'my-plugin.action': '执行操作'
  },
  'en-US': {
    'my-plugin.title': 'My Plugin',
    'my-plugin.action': 'Run action'
  }
}

module.exports.activate = function activate(scriba) {
  Object.keys(messages).forEach((language) => {
    scriba.i18n.registerTranslations(language, messages[language])
  })

  scriba.commands.register({
    id: 'my-plugin.action',
    name: 'Run action',
    nameKey: 'my-plugin.action',
    run: () => scriba.ui.showToast(scriba.i18n.t('my-plugin.action'))
  })
}
```

---

## 7. Debugging

- Use `Ctrl/Cmd + Shift + I` to open DevTools.
- Plugin exceptions are printed to the console and shown in a toast.
- After changing a plugin, use **Plugin Manager → Reload**.
- If a plugin shortcut does not work, check whether a core command has claimed the same combo in **Settings → Shortcuts** (user bindings take precedence).
- Use `scriba.log(...)` for logs with a plugin prefix.
- Status bar and sidebar elements are ordinary DOM nodes and can be inspected in DevTools.

---

## 8. Packaging and publishing

### 8.1 Install from a folder

In the plugin manager, click **Install from folder** and select the folder containing `manifest.json`. The app copies it to `<userData>/plugins/<id>/`.

### 8.2 GitHub topic (recommended)

1. Push the plugin to a public GitHub repository.
2. Add the `scriba-plugin` topic to the repository (Settings → Topics).
3. Users can search for it in **Plugin Manager → Browse** and install it.

The app downloads the repository's source archive (zipball) at install time, so no Release assets are required.

### 8.3 JSON index

Useful for intranets, private distribution, or curated catalogs. The index is a JSON file whose entries point to ZIP archives:

```json
{
  "version": 1,
  "plugins": [
    {
      "id": "my-plugin",
      "name": "My Plugin",
      "version": "1.0.0",
      "description": "One-line description",
      "author": "Your Name",
      "license": "MIT",
      "homepage": "https://github.com/you/my-plugin",
      "minAppVersion": "0.1.0",
      "keywords": ["statusbar"],
      "download": "https://example.com/releases/my-plugin-1.0.0.zip"
    }
  ]
}
```

See [MARKETPLACE.md](MARKETPLACE.md) for the full index maintenance workflow.

### 8.4 ZIP requirements

A plugin ZIP must satisfy:

1. It contains `manifest.json` at the archive root or in a subdirectory (for example `plugin/manifest.json`).
2. The `id` in `manifest.json` matches the index entry.
3. Only stored / deflate compression is supported; ZIP64 and encryption are not.
4. The extracted size must not exceed 64 MB; the archive itself must not exceed 32 MB.
5. Entries with `../`, absolute paths, or other path traversal are rejected.

### 8.5 Publishing steps

See [PLUGIN_SPEC.md](PLUGIN_SPEC.md) for naming rules, manifest validation, and the complete publishing workflow.

---

## 9. Security

- Plugins run with the same privileges as the app and can access the DOM, the network, and local storage.
- Plugin entry points avoid `eval`, but plugin code itself is not sandboxed.
- Marketplace installation validates the manifest, version, download URL, size, and path traversal, but **does not verify code signatures**.
- Only install plugins from trusted sources, and never hard-code secrets or tokens in plugin code.

---

## 10. Compatibility and best practices

### 10.1 Version compatibility

- Set `minAppVersion` and detect optional APIs in `activate`.
- Do not depend on undocumented internals or DOM structure.
- Do not use `import` / `export` in the entry; use CommonJS or plain script style.

### 10.2 Performance

- `doc:change` can be very frequent; debounce expensive work.
- Update only the necessary DOM in status bar and sidebar items.
- Code block renderers may be called repeatedly; cache or cancel expensive work.
- Avoid long synchronous work in `activate`.

### 10.3 Cleanup

- Clean up timers, DOM listeners, observers, and network connections in `deactivate`.
- Define `deactivate` at module scope and keep it synchronous.
- Event subscriptions, contributions, and `style.css` are cleaned up by the runtime.

### 10.4 Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Plugin not listed | Missing `manifest.json`, or invalid `id`/`name`/`version` | Check the manifest and the plugin manager message |
| Plugin fails to load | `activate` threw, entry file missing, or syntax error | Open DevTools and check the console |
| Command not shown | Duplicate command id, or `register` did not run | Check the id and console warnings |
| Shortcut does nothing | The combo is claimed by a core command's user binding, or the command belongs to another plugin | Check whether **Settings → Shortcuts** uses the same combo |
| Styles not applied | `style.css` missing or activation failed | Confirm the file exists and the plugin is enabled |
| Code renderer not running | Cursor is still inside the block, or the language case does not match | Move the cursor out; languages are lowercased |

---

## 11. Related documentation

- [项目与软件介绍（中文）](PROJECT.md) / [Project & Software Overview (English)](PROJECT.en.md)
- [插件与 API 文档（中文）](PLUGIN_API.md) / [Plugin & API Documentation (English)](PLUGIN_API.en.md)
- [Plugin specification and publishing](PLUGIN_SPEC.md)
- [Marketplace index maintenance](MARKETPLACE.md)
- [Contributing guide](../CONTRIBUTING.md)
- [README](../README.md)
