# Scriba Project & Software Overview

[简体中文](PROJECT.md) · English

> An open-source, plugin-driven WYSIWYG Markdown editor.

---

## 1. Overview

Scriba is a desktop editor for people who write in Markdown. It hides Markdown syntax behind a live, rendered view: the line containing the cursor shows its source, while the rest of the document is displayed as formatted content. Writers can draft, organize, search, and export without constantly switching between source and preview.

The project is built with **Electron + React + TypeScript + CodeMirror 6**, released under the MIT License, and is currently at version **0.1.0**.

### 1.1 Design goals

- **Focus on writing**: reduce syntax noise and render headings, lists, tables, images, and math directly in the editor.
- **Local-first**: documents, images, themes, and plugins stay on the local machine; no cloud service is required.
- **Extensible**: JavaScript plugins can add commands, shortcuts, status bar items, sidebar panels, code block renderers, themes, and interface languages.
- **Open ecosystem**: plugins can be distributed through the GitHub `scriba-plugin` topic or a self-hosted JSON index, without a central server.
- **Controlled security**: the renderer uses context isolation and a CSP without `eval`; plugin entry points are loaded as Blob modules.

### 1.2 Who it is for

- Technical writers, knowledge-base maintainers, and note-takers
- Bloggers, teachers, and meeting note-takers
- Users who want Markdown source files with an editing experience closer to Word
- Developers who want to extend an editor with plugins

### 1.3 Project information

| Item | Value |
| --- | --- |
| Name | Scriba |
| Version | 0.1.0 |
| License | MIT |
| Stack | Electron, React, TypeScript, CodeMirror 6 |
| Platforms | Windows, macOS, Linux |
| Repository | <https://github.com/hui139/scriba> |
| Issues | <https://github.com/hui139/scriba/issues> |

---

## 2. Key features

### 2.1 WYSIWYG editing

- Headings, bold, italic, strikethrough, highlight, underline, superscript/subscript, inline code, links, images, blockquotes, lists, task lists, horizontal rules, footnotes, `[TOC]`, and YAML front matter are rendered directly in the editor.
- The current line reveals its Markdown source; moving away restores the rendered view, balancing precise editing with readability.
- Source mode can switch between live preview and raw Markdown.

### 2.2 Editing productivity

- Press Enter to continue a list; press Backspace to remove a list marker.
- Paste a URL over selected text to create a link automatically.
- Inline HTML tags are closed automatically.
- Paragraph and insert menus cover headings, quotes, ordered/unordered/task lists, and indentation.
- The command palette (`Ctrl/Cmd + P`) runs commands quickly.
- Shortcuts are user-customizable; binding conflicts release the previous binding.

### 2.3 Table editing

- Type directly in cells and add rows or columns with one click.
- Right-click to insert/delete rows or columns and set alignment.
- Drag the right edge of a header to resize a column; double-click to restore automatic width.
- Column widths are persisted per document and never written into the Markdown source.

### 2.4 Images

- Paste screenshots or drag image files into the document.
- Images are saved to an `assets/` folder next to the document and linked with a relative path.
- Image size syntax is supported: `![alt](pic.png =200x)`, `=200x150`, `=x150`, in both preview and export.

### 2.5 Files and workspace

- The file tree supports opening folders, creating, renaming, deleting, drag-and-drop, and filtering by name.
- Multi-tab editing with automatic synchronization of external changes.
- Renaming a document updates references in other files (skipping code blocks and inline code).
- The recent-files menu keeps the last 10 documents.
- Optional auto-save writes to disk 1 second after typing stops.
- Workspace-wide text search groups matches by file, supports case sensitivity, whole-word matching, and regular expressions, and jumps to the matching line.

### 2.6 Export and publishing

- Export to HTML, PDF, Word (`.doc`), plain text, PNG, LaTeX, and EPUB.
- EPUB generates a multi-level table of contents from headings and packages images into the archive with rewritten paths.
- Relative image paths are inlined automatically during export.
- Export style templates: drop CSS files into `<userData>/export-templates/` and they are applied to HTML / PDF / Word exports.
- Direct printing is supported.
- The entire workspace (Markdown and images) can be copied to a target directory, skipping `node_modules`, `.git`, and other folders, with optional filtering by extension.

### 2.7 Appearance and experience

- Built-in themes: Violet Night (default), Light, Dark, Solarized Light, Solarized Dark, and Nord.
- User CSS themes (in `<userData>/themes/`) and plugin themes are supported.
- Focus mode, typewriter mode, line numbers, and a spellcheck toggle.
- Interface languages: built-in English and Simplified Chinese, switchable from Settings, the status bar, or the command palette; native menus are translated as well.

### 2.8 Extensibility

- JavaScript plugins can register commands, shortcuts, status bar items, sidebar panels, code block renderers, themes, interface languages, and translations.
- Plugins can access the editor API, isolated storage, KaTeX, and Mermaid.
- Built-in plugins: language switcher, word count, reading time, and code language label.
- The plugin marketplace supports two distribution models: GitHub `scriba-plugin` topic search and a self-hosted JSON index.

---

## 3. Architecture

### 3.1 Technology stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Electron 33 |
| UI | React 18, TypeScript 5.6 |
| Editor | CodeMirror 6 |
| State | Zustand 5 |
| Markdown parsing | marked 14, DOMPurify 3 |
| Math | KaTeX 0.16 |
| Diagrams | Mermaid 11 |
| File watching | chokidar 3 |
| Build | electron-vite 2, Vite 5 |
| Packaging | electron-builder 25 (NSIS / DMG / AppImage) |

### 3.2 Processes and modules

Scriba follows the standard Electron three-layer structure:

```
┌──────────────────────────────────────────────┐
│ Main process (Node.js)                       │
│ windows, native menu, filesystem, exports,   │
│ plugin scanning, IPC                         │
└──────────────────────┬───────────────────────┘
                       │ contextBridge (preload)
┌──────────────────────▼───────────────────────┐
│ Renderer (React + TypeScript)                │
│  ├─ CodeMirror 6 editor and live preview     │
│  ├─ file tree, tabs, search, settings,       │
│  │  plugin manager                           │
│  ├─ plugin runtime and contribution registry │
│  └─ Markdown → HTML export                   │
└──────────────────────────────────────────────┘
```

- **Main process**: window lifecycle, native menus, file I/O, folder watching, export (HTML/PDF/Word/EPUB, etc.), plugin discovery and installation, and the GitHub / JSON-index marketplace.
- **preload**: exposes a controlled `window.api` through `contextBridge`; the renderer never touches Node.js directly.
- **Renderer**: hosts the React UI and the CodeMirror editor. Plugins also run in this process.

### 3.3 How live preview works

Live preview is built on CodeMirror 6 decorations and widgets:

1. CodeMirror parses the Markdown document into a syntax tree.
2. When the cursor is outside a syntax node, a widget replaces the corresponding marker or block.
3. Dedicated widgets render headings, lists, tables, images, math, and Mermaid diagrams.
4. When the cursor enters the node, the source is shown again for precise editing.
5. When the cursor leaves a code block, a built-in or plugin renderer can take over.

### 3.4 Plugin runtime

The plugin system has three parts:

- **Main-process scanning**: reads `manifest.json`, the entry file, and `style.css` from `<userData>/plugins/<id>/` and the built-in `plugins/<id>/`.
- **Renderer loading**: wraps the CommonJS entry in a compatibility shim and executes it as a Blob module, avoiding `eval` and `unsafe-eval`.
- **Contribution registry**: manages commands, keybindings, status bar items, sidebar panels, themes, and code block renderers; disabling a plugin removes its contributions automatically.

See the [Plugin & API documentation](PLUGIN_API.en.md) for details.

### 3.5 Build and packaging

- `electron-vite` builds the main process, preload, and renderer into `out/`.
- `electron-builder` reads `electron-builder.yml` and packages `out/**/*`, `plugins/**/*`, and `package.json`.
- Windows produces an NSIS installer (x64), macOS a DMG, and Linux an AppImage.
- The app is packaged as an asar archive; built-in plugins ship with the application.

### 3.6 Security model

- The renderer enables context isolation; preload exposes only a whitelisted API.
- The CSP does not include `unsafe-eval`; plugin entry points are loaded as Blob modules and only need `script-src blob:`.
- Plugins run with the same privileges as the app and can access the DOM, the network, and `localStorage`. **Only install plugins from trusted sources.**
- Marketplace installation validates the manifest, version, download URL, archive size, and path traversal. Code signing is not verified yet.

---

## 4. Project structure

```
Scriba/
├─ src/
│  ├─ main/                 Electron main process
│  │  ├─ index.ts           app entry, window, lifecycle
│  │  ├─ menu.ts            native menu
│  │  ├─ ipc/               IPC handlers (files, plugins, app)
│  │  └─ export/            export and marketplace implementation
│  ├─ preload/              contextBridge API
│  ├─ renderer/             React renderer
│  │  └─ src/
│  │     ├─ editor/         CodeMirror editor, live preview, widgets
│  │     ├─ plugins/        plugin runtime and contribution registry
│  │     ├─ components/     UI components
│  │     ├─ markdown/       Markdown → HTML / EPUB / Word export
│  │     ├─ i18n/           interface languages and translations
│  │     ├─ shortcuts/      shortcut definitions and persistence
│  │     ├─ store/          settings, workspace, and UI state
│  │     └─ styles/         global, editor, and theme styles
│  └─ shared/               types and utilities shared by main and renderer
├─ plugins/                 built-in plugins
├─ docs/                    project and plugin documentation
├─ scripts/                 dev launcher, icon and index build scripts
├─ assets/                  icon source files
├─ build/                   packaging resources (icons, etc.)
├─ electron-builder.yml     packaging configuration
├─ electron.vite.config.ts  build configuration
└─ package.json
```

---

## 5. Installation and running

### 5.1 Requirements

- Node.js 20 or newer
- npm 10 or newer
- Windows / macOS / Linux

### 5.2 Install dependencies

```bash
npm install
```

For networks in mainland China, a mirror can be used:

```bash
npm install --registry=https://registry.npmmirror.com
```

If the Electron binary download fails:

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install --registry=https://registry.npmmirror.com
```

### 5.3 Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start development mode |
| `npm run preview` | Preview the built output |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run build` | Build main, preload, and renderer |
| `npm run smoke` | Run the UI smoke test (build first) |
| `npm run pack` | Build and produce an unpacked app directory |
| `npm run dist` | Build and produce installers |
| `npm run icons` | Generate application icons |
| `npm run index` | Generate a plugin marketplace index |

### 5.4 Packaging

```bash
npm run dist
```

Artifacts are written to `release/`. Windows produces an NSIS installer, macOS a DMG, and Linux an AppImage by default.

---

## 6. Usage guide

### 6.1 Open a file or folder

- Use **File → Open File** or `Ctrl/Cmd + O` to open a single Markdown file.
- Use **File → Open Folder** or `Ctrl/Cmd + Shift + O` to open a workspace.
- Files and folders can also be dragged into the window.
- The packaged app supports command-line opening: `scriba path/to/file.md` or `scriba path/to/folder`.

### 6.2 Editing and preview

- Live preview is the default; the current line shows its source.
- Use `Ctrl/Cmd + /` or the status bar button to toggle source mode.
- The status bar shows the cursor position, word count, and character count.
- `F8` enters focus mode; `F9` enters typewriter mode.

### 6.3 Tables

- Type directly into cells.
- Use the buttons on the right side of a table to add rows or columns.
- Right-click a cell or header to insert/delete rows or columns and set alignment.
- Drag the right edge of a header to resize a column; double-click to restore automatic width.

### 6.4 Images

- Paste screenshots or drag image files into the document.
- Images are saved to an `assets/` folder next to the document and linked with a relative path.
- Use `=widthxheight` to control display size, for example `![logo](assets/logo.png =200x)`.

### 6.5 Find and search

- `Ctrl/Cmd + F` opens the find bar; `Ctrl/Cmd + H` opens find and replace.
- Supports case sensitivity, whole-word matching, regular expressions, and replace-all.
- The sidebar **Search** tab searches the entire workspace, groups results by file, and highlights matching fragments.

### 6.6 Export

- **File → Export** supports HTML, PDF, Word, plain text, PNG, LaTeX, and EPUB.
- Export style templates live in `<userData>/export-templates/`.
- Relative images are inlined during export; EPUB packages images into the archive.

### 6.7 Themes, languages, and shortcuts

- Settings → Appearance: theme, font, line numbers, focus mode, and more.
- Settings → Editor: auto-save, auto-pair, spellcheck, and more.
- Settings → Shortcuts: rebind individual shortcuts or restore defaults.
- The interface language can be switched from Settings, the status bar, or the command palette; the shortcut is `Ctrl/Cmd + Shift + L`.

### 6.8 Plugin management

- Open **Plugins → Plugin Manager** to view installed plugins.
- Enable/disable, reload, install from a folder, or uninstall user plugins.
- The **Browse** tab searches GitHub plugins or uses a custom JSON index.
- Built-in plugins ship with the app and cannot be uninstalled.

---

## 7. Data and configuration locations

Scriba stores user data in Electron's `userData` directory. Common contents:

| Path | Contents |
| --- | --- |
| `<userData>/plugins/` | User-installed plugins |
| `<userData>/themes/` | User CSS themes |
| `<userData>/export-templates/` | Export style templates |
| `<userData>/plugins-state.json` | Plugin enabled/disabled state |
| `<userData>/recent-files.json` | Recently opened files |
| `<userData>/github-token.json` | Optional GitHub read-only token |
| `<workspace>/assets/` | Pasted or dropped images |

Plugins can use `scriba.storage` for plugin-isolated `localStorage`. Themes and export templates are read directly from the directories above.

---

## 8. Plugin system

A plugin is a folder containing `manifest.json` and an entry script. The entry uses CommonJS style and exports `activate(scriba)`. Plugins can:

- Register commands and shortcuts
- Add status bar items and sidebar panels
- Register custom code block renderers
- Register themes
- Register interface languages and translations
- Listen for file open, file save, document change, editor ready, and workspace change
- Use the editor API, isolated storage, KaTeX, and Mermaid

For the complete interface, lifecycle, examples, and publishing process, see:

- [Plugin & API Documentation (English)](PLUGIN_API.en.md)
- [插件与 API 文档（中文）](PLUGIN_API.md)
- [Plugin specification and publishing](PLUGIN_SPEC.md)
- [Marketplace index maintenance](MARKETPLACE.md)

> Security note: plugins run with the same privileges as the app and can access the DOM, the network, and local storage. Only install plugins from trusted sources.

---

## 9. Development and contributing

### 9.1 Pre-commit checks

```bash
npm run typecheck
npm run build
```

### 9.2 Code style

- TypeScript strict mode
- Functional React components and hooks
- No heavy dependencies without prior discussion
- User-facing strings default to English; documentation may be bilingual
- Follow the existing directory structure and naming

### 9.3 Commit messages

Use concise imperative sentences, for example:

```
feat: add table of contents command
fix: prevent stale decorations after switching tabs
docs: document plugin theme variables
```

### 9.4 Changing the plugin API

The plugin API is defined in `src/renderer/src/plugins/types.ts`, the runtime is in `src/renderer/src/plugins/runtime.ts`, and the contribution registry is in `src/renderer/src/plugins/registry.ts`. When adding an API, update both the Chinese and English plugin documentation and the example plugins.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for more conventions.

---

## 10. Roadmap

- [x] Plugin marketplace (JSON index + one-click install, customizable index URL)
- [x] Visual table editing (cell editing, row/column insertion, right-click alignment)
- [x] Auto-save (toggleable, writes 1 second after changes)
- [ ] Version history
- [x] English/Chinese UI switching (plugins can extend languages via `scriba.i18n`)
- [x] Word export
- [x] Plain-text export and printing
- [x] Image (PNG) and LaTeX export
- [x] Automatic inlining of relative images during export
- [x] Find and replace (case sensitivity, whole word, regex, replace all)
- [x] Paragraph and insert menus (heading shortcuts, lists, footnotes, TOC, etc.)
- [x] Recent files
- [x] Workspace-wide text search (grouped by file, jump to line)
- [x] Image size syntax (`=WxH`, consistent in preview and export)
- [x] Highlighted matching fragments in search results
- [x] Export style templates (`export-templates/*.css`)
- [x] EPUB export (EPUB 3, images packaged into the archive, multi-level TOC from headings)
- [x] Automatic reference updates on rename (skipping code blocks and inline code)
- [x] Drag-to-resize table columns (persisted per document, never pollutes Markdown source)
- [x] Editing enhancements: list continuation, URL paste to link, automatic HTML tag closing
- [x] Custom shortcuts (per-item rebinding in Settings, automatic conflict release)
- [x] Folder export (Markdown and image assets)
- [x] Spellcheck toggle (off by default; picks an available dictionary and falls back to English on Chinese systems)
- [ ] Collaboration and cloud sync (optional)

---

## 11. License

Scriba is released under the [MIT License](../LICENSE).

---

## 12. Related documentation

- [README](../README.md)
- [项目与软件介绍（中文）](PROJECT.md) / [Project & Software Overview (English)](PROJECT.en.md)
- [插件与 API 文档（中文）](PLUGIN_API.md) / [Plugin & API Documentation (English)](PLUGIN_API.en.md)
- [Plugin specification and publishing](PLUGIN_SPEC.md)
- [Marketplace index maintenance](MARKETPLACE.md)
- [Contributing guide](../CONTRIBUTING.md)
