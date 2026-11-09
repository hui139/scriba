# Scriba 插件与 API 接口文档

[简体中文](PLUGIN_API.md) · [English](PLUGIN_API.en.md)

> 适用版本：Scriba 0.1.0+  
> API 版本：随应用版本发布；新增能力保持向后兼容，移除或破坏性变更会提升主版本号。

---

## 目录

1. [概述](#1-概述)
2. [快速开始](#2-快速开始)
3. [插件目录与清单](#3-插件目录与清单)
4. [生命周期与模块格式](#4-生命周期与模块格式)
5. [API 参考](#5-api-参考)
6. [示例](#6-示例)
7. [调试](#7-调试)
8. [打包与发布](#8-打包与发布)
9. [安全](#9-安全)
10. [兼容性与最佳实践](#10-兼容性与最佳实践)
11. [相关文档](#11-相关文档)

---

## 1. 概述

Scriba 插件是运行在编辑器渲染进程中的普通 JavaScript。一个插件就是一个文件夹，包含一份清单文件和入口脚本；可选地包含 `style.css`，应用会在插件启用后自动注入。

插件可以扩展以下能力：

- 命令与快捷键
- 状态栏项与侧栏面板
- 自定义代码块渲染器
- 主题
- 界面语言与翻译
- 文件打开、保存、文档变化、编辑器就绪、工作区变化等事件
- 编辑器读写、隔离存储、KaTeX 与 Mermaid

> **安全提示**：插件与应用同权限运行，可以访问 DOM、网络与 `localStorage`。请只安装可信来源的插件。

### 1.1 适用读者

- 想为 Scriba 增加功能的插件作者
- 需要维护内部插件或私有插件市场的团队
- 想了解插件运行方式与 API 边界的贡献者

### 1.2 设计原则

- **显式注册**：所有贡献点通过 `scriba` 对象注册，禁用插件时由运行时自动移除。
- **最小权限面**：渲染进程不直接接触 Node.js；插件通过公开 API 操作编辑器与界面。
- **无 `eval`**：插件入口通过 Blob 模块执行，兼容不包含 `unsafe-eval` 的 CSP。
- **可清理**：事件订阅与贡献点会自动注销；定时器、DOM 监听器等资源应由 `deactivate` 清理。

---

## 2. 快速开始

### 2.1 最小插件

新建文件夹 `my-plugin/`：

```
my-plugin/
├─ manifest.json
└─ index.js
```

`manifest.json`：

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

`index.js`：

```js
module.exports.activate = function activate(scriba) {
  scriba.commands.register({
    id: 'my-plugin.hello',
    name: 'Say Hello',
    run: () => scriba.ui.showToast('Hello from my plugin!')
  })
}
```

### 2.2 安装与启用

1. 打开 **插件 → 插件管理器**。
2. 点击 **从文件夹安装**，选择 `my-plugin/`。
3. 插件会出现在「已安装」列表中，默认启用。
4. 修改代码后，点击 **重新加载** 使改动生效。

也可以直接把插件文件夹放入 `<userData>/plugins/<plugin-id>/`，然后重新加载。

### 2.3 验证

- 打开命令面板（`Ctrl/Cmd + P`），搜索 “Say Hello”。
- 执行命令后应看到带插件名前缀的提示。
- 若没有出现，打开开发者工具（`Ctrl/Cmd + Shift + I`）查看控制台错误。

---

## 3. 插件目录与清单

### 3.1 目录结构

```
my-plugin/
├─ manifest.json      # 必需
├─ index.js           # 入口，可由 manifest.main 指定
├─ style.css          # 可选，激活成功后自动注入
└─ README.md          # 可选，说明用法
```

插件安装位置：

- 用户插件：`<userData>/plugins/<plugin-id>/`
- 内置插件：应用目录下的 `plugins/<plugin-id>/`

如果用户插件与内置插件使用相同的 `id`，**内置插件优先**，用户插件不会覆盖它。

### 3.2 `manifest.json`

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "这个插件做什么",
  "author": "Your Name",
  "license": "MIT",
  "homepage": "https://github.com/you/my-plugin",
  "main": "index.js",
  "minAppVersion": "0.1.0",
  "keywords": ["statusbar", "productivity"]
}
```

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `id` | 是 | 唯一标识，建议小写字母与连字符；命名规则见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md) |
| `name` | 是 | 显示名称 |
| `version` | 是 | 语义化版本，如 `1.0.0` |
| `description` | 否 | 插件描述，显示在插件管理器中 |
| `author` | 否 | 作者 |
| `license` | 否 | SPDX 许可证标识，如 `MIT` |
| `homepage` | 否 | 仓库或文档地址 |
| `main` | 否 | 入口文件名，默认 `index.js` |
| `minAppVersion` | 否 | 要求的最低应用版本 |
| `keywords` | 否 | 便于检索的关键词数组 |

### 3.3 版本兼容性

`minAppVersion` 会与当前应用版本按点分数字段逐段比较。低于要求时：

- 插件仍会列出，并显示「需要 vX.Y.Z+」提示。
- 建议插件在 `activate` 内检测可选 API 是否存在，而不是直接假设。

```js
module.exports.activate = function activate(scriba) {
  if (typeof scriba.editor.replaceRange === 'function') {
    // 使用较新的 API
  } else {
    // 回退到旧实现
  }
}
```

### 3.4 命名与发布规范

插件 `id`、仓库名、版本号与发布步骤的完整规范见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)。摘要：

- `id`：3–64 字符，小写字母、数字、连字符，首尾必须是字母或数字，不能连续连字符；不能使用保留字（如 `core`、`scriba`、`plugin`）。
- 版本号：必须是语义化版本（`主.次.修订`，可带预发布后缀）。
- 仓库名推荐 `scriba-plugin-<id>`；给公开 GitHub 仓库添加 `scriba-plugin` 主题即可被市场搜索到。

---

## 4. 生命周期与模块格式

### 4.1 `activate` 与 `deactivate`

入口使用 CommonJS 风格，必须导出 `activate`：

```js
module.exports.activate = function activate(scriba) {
  // 注册贡献点
}

module.exports.deactivate = function deactivate() {
  // 可选：清理定时器、DOM 监听器等资源
}
```

- `activate` 可以是 `async`；运行时会等待它完成。
- 调用时机：应用启动、插件被启用、插件被重新加载。
- 禁用插件或重新加载时，运行时先调用 `deactivate`，再自动移除该插件注册的所有贡献点。
- `deactivate` 应为**同步函数**；运行时不会等待异步清理完成。

> **重要**：`deactivate` 必须在**模块顶层**赋值，不能在 `activate` 内赋值。运行时在模块求值时读取 `module.exports.deactivate`，之后再调用 `activate`；在 `activate` 内赋值不会被运行时捕获。

### 4.2 模块格式

入口源码会被包裹进一个 CommonJS 兼容包装器，再以 ES 模块方式执行。因此：

- **不支持 `import` / `export` 语法**。
- 使用 `module.exports.activate = ...` 或纯脚本写法。
- 包装器内部启用严格模式（`"use strict"`）。
- `scriba` 通过参数传入，不需要从全局变量获取。
- 可以使用标准浏览器 API（`document`、`window`、`localStorage`、`fetch` 等）。

### 4.3 错误处理

- `activate` 抛出的异常会被捕获，本次激活中止并弹出提示，不影响其他插件。
- 控制台会输出 `[scriba] failed to activate plugin "<id>"` 及错误详情。
- `deactivate` 抛出的异常会被记录，但不会阻止其他插件清理。
- 调试时用 `Ctrl/Cmd + Shift + I` 打开开发者工具。

### 4.4 自动清理

以下资源会由运行时自动清理：

- 通过 `scriba.commands.register` 注册的命令
- 通过 `scriba.commands.registerKeybinding` 注册的快捷键
- 通过 `scriba.ui.addStatusBarItem` / `addSidebarPanel` 添加的界面项
- 通过 `scriba.themes.register` 注册的主题
- 通过 `scriba.markdown.registerCodeBlockRenderer` 注册的渲染器
- 通过 `scriba.events.on` 注册的事件监听器
- 通过 `scriba.i18n.registerLanguage` / `registerTranslations` 注册的语言与翻译
- 自动注入的 `style.css`

**不会**自动清理的资源包括：`setTimeout` / `setInterval`、`document.addEventListener`、`window.addEventListener`、`MutationObserver`、WebSocket、`fetch` 长轮询等。请在 `deactivate` 中自行清理。

---

## 5. API 参考

`activate(scriba)` 收到的对象包含以下成员：

| 成员 | 用途 |
| --- | --- |
| `scriba.manifest` | 当前插件的清单信息 |
| `scriba.editor` | 编辑器读写与光标操作 |
| `scriba.commands` | 命令与快捷键 |
| `scriba.ui` | 状态栏、侧栏、提示 |
| `scriba.markdown` | 自定义代码块渲染器 |
| `scriba.themes` | 主题注册 |
| `scriba.events` | 应用事件订阅 |
| `scriba.i18n` | 翻译、语言注册与切换 |
| `scriba.storage` | 按插件隔离的持久化存储 |
| `scriba.libs` | 内置第三方库（KaTeX、Mermaid） |
| `scriba.log` | 带插件前缀的日志输出 |

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

只读对象。`license` 与 `main` 不在运行时清单对象中，需要时请从 `manifest.json` 读取或自行保存。

### 5.2 `scriba.editor`

编辑器操作。所有方法在无活动文档时安全地不做任何事；读取类方法返回空字符串或默认值。

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

| 方法 | 说明 |
| --- | --- |
| `getText()` | 返回当前文档全文；无文档时返回 `''` |
| `setText(text)` | 用新文本替换整篇文档 |
| `getSelection()` | 返回当前选区文本；无选区时返回 `''` |
| `replaceSelection(text)` | 用文本替换当前选区，并把光标移到插入内容末尾；会聚焦编辑器 |
| `insertText(text)` | 在光标处插入文本，并把光标移到插入内容末尾；会聚焦编辑器 |
| `wrapSelection(before, after?)` | 在选区两侧包裹文本；`after` 省略时与 `before` 相同；会聚焦编辑器 |
| `getCursor()` | 返回 1 基的 `{ line, col }`；无文档时返回 `{ line: 1, col: 1 }` |
| `scrollToLine(line)` | 把光标移到指定行行首，居中滚动并聚焦编辑器；行号会被限制在有效范围内 |
| `focus()` | 聚焦编辑器 |
| `replaceRange(from, to, text)` | 替换两个 **0 基字符偏移** 之间的文本；偏移会被限制在文档范围内；保持选区映射；不自动聚焦 |

示例：在光标处插入当前日期

```js
scriba.commands.register({
  id: 'my-plugin.insertDate',
  name: '插入当前日期',
  run: () => scriba.editor.insertText(new Date().toISOString().slice(0, 10))
})
```

示例：替换文档中的第一处文本

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
  id: string,          // 建议加插件前缀，如 "my-plugin.hello"
  name: string,        // 命令面板中显示的名称
  nameKey?: string,    // 可选 i18n 键，优先于 name
  hint?: string,       // 快捷键提示文本
  run: () => void | Promise<void>
}): void

execute(id: string): Promise<void>
list(): string[]                       // 当前已注册的所有命令 id
registerKeybinding({ command, combo }): void
```

| 方法 | 说明 |
| --- | --- |
| `register(command)` | 注册命令；重复 `id` 会输出警告并忽略后一次注册 |
| `execute(id)` | 执行命令；未知命令会输出警告并返回已解决的 Promise |
| `list()` | 返回当前所有已注册命令的 `id`（包括其他插件与核心命令） |
| `registerKeybinding({ command, combo })` | 为本插件自己的命令绑定快捷键 |

#### 为命令绑定快捷键

```js
scriba.commands.registerKeybinding({
  command: 'my-plugin.insertDate',
  combo: 'mod+alt+d'
})
```

组合键格式（`mod` 在 Windows/Linux 上是 Ctrl，在 macOS 上是 ⌘）：

| 写法 | 含义 |
| --- | --- |
| `mod+b` | Ctrl/⌘ + B |
| `mod+shift+x` | Ctrl/⌘ + Shift + X |
| `mod+alt+p` | Ctrl/⌘ + Alt + P |
| `f8` | F8 |
| `mod+1` | Ctrl/⌘ + 1 |

规则：

- 只能绑定到**本插件自己注册的命令**；绑定其他插件的命令会被拒绝并输出警告。
- 绑定到不存在的命令会被忽略并输出警告。
- 用户为内置命令设置的快捷键优先于插件绑定；插件命令本身不会出现在「设置 → 快捷键」列表中。
- 同一命令多次注册快捷键时，后一次生效。

### 5.4 `scriba.ui`

```ts
addStatusBarItem({
  id: string,
  element: HTMLElement,
  order?: number       // 越小越靠左，默认 100
}): void

addSidebarPanel({
  id: string,
  title: string,
  render: () => HTMLElement   // 界面渲染面板时调用
}): void

showToast(message: string, type?: 'info' | 'error' | 'success'): void
```

| 方法 | 说明 |
| --- | --- |
| `addStatusBarItem(item)` | 在状态栏添加元素；按 `order` 升序排列；相同 `id` 会覆盖 |
| `addSidebarPanel(panel)` | 在侧栏「插件」视图添加面板；`render` 返回要挂载的元素；相同 `id` 会覆盖 |
| `showToast(message, type?)` | 显示提示，消息会自动加上 `[插件名]` 前缀 |

状态栏元素与侧栏面板元素由插件自行创建并更新。侧栏的 `render` 可能在面板注册表更新时被多次调用；建议返回同一个缓存元素，避免重复创建导致状态丢失。

#### 跟随界面缩放

应用设置里有「界面缩放」，用户可以把侧栏、菜单、对话框的字号在 85%–140% 之间调整。核心界面通过 CSS 变量实现：

```css
font-size: calc(12px * var(--ui-scale));
```

`--ui-scale` 是全局 CSS 变量，值为 `1` 表示 100%。**插件自己创建的界面默认不会跟随缩放**，因为字号由插件自己的 CSS 决定。要支持缩放，把字号写成同样的形式：

```js
const label = document.createElement('div')
label.textContent = 'Hello'
// 推荐：随界面缩放
label.style.fontSize = 'calc(12px * var(--ui-scale))'
// 不推荐：写死会被用户放大界面后显得过小
// label.style.fontSize = '12px'
```

插件可以直接在自己的 `<style>` 或元素的 `style` 里使用 `var(--ui-scale)`，无需读取任何 API。若不希望跟随缩放（例如需要用固定像素对齐的图形），保持固定值即可。

示例：状态栏显示当前时间

```js
let timer = 0
let item = null

module.exports.activate = function activate(scriba) {
  item = document.createElement('span')
  // 跟随应用的界面缩放，用户调整字号时一起变化。
  item.style.fontSize = 'calc(12px * var(--ui-scale))'
  const update = () => {
    if (item) item.textContent = new Date().toLocaleTimeString()
  }
  update()
  scriba.ui.addStatusBarItem({ id: 'my-plugin.clock', element: item, order: 20 })
  timer = setInterval(update, 1000)
}

// 必须在模块顶层赋值，运行时才能在模块求值时捕获它。
module.exports.deactivate = function deactivate() {
  clearInterval(timer)
  timer = 0
  item = null
}
```

### 5.5 `scriba.markdown`

为自定义代码块语言注册渲染器。光标不在代码块内时，代码块会被替换为渲染结果；光标进入代码块时恢复源码。

```ts
registerCodeBlockRenderer(
  language: string,
  renderer: (code: string, element: HTMLElement) => void | Promise<void>
): void

getCodeBlockRenderer(language: string): CodeBlockRenderer | undefined
```

| 方法 | 说明 |
| --- | --- |
| `registerCodeBlockRenderer(language, renderer)` | 注册渲染器；`language` 会被转为小写；相同语言后注册者覆盖先注册者 |
| `getCodeBlockRenderer(language)` | 按语言查找渲染器，大小写不敏感 |

行为说明：

- 渲染器只在**光标离开代码块**时运行。
- 传入的 `element` 是新建的容器，渲染器负责填充内容。
- 同步异常会被捕获并显示为错误文本。
- 如果渲染器返回 Promise，应用不会等待或捕获其异步异常；请自行 `try/catch`。

示例：

```js
scriba.markdown.registerCodeBlockRenderer('plantuml', async (code, el) => {
  el.textContent = 'Rendering…'
  try {
    // 这里可以调用外部服务或本地库
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

注册的主题会出现在主题列表中。`css` 会被注入到页面中，请使用 `:root[data-theme="your-id"]` 作用域，避免影响其他主题：

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

相同 `id` 会覆盖已有主题。插件主题与内置主题、用户主题一起显示；用户选择的主题 id 会保存在设置中。

### 5.7 `scriba.events`

```ts
on(event: 'file:open' | 'file:save' | 'doc:change' | 'editor:ready' | 'workspace:change',
   cb: (payload?: unknown) => void): () => void
```

返回取消订阅函数。插件卸载时，运行时也会自动取消通过该 API 注册的监听器。

| 事件 | payload | 触发时机 |
| --- | --- | --- |
| `file:open` | 文件绝对路径 | 打开文件后 |
| `file:save` | 文件绝对路径 | 保存文件后 |
| `workspace:change` | 工作区根目录路径 | 打开或切换工作区后 |
| `editor:ready` | 无 | 编辑器实例就绪后 |
| `doc:change` | 当前文档全文 | 文档内容变化时（可能非常频繁） |

建议对 `doc:change` 中的重计算做防抖，例如：

```js
let timer = 0
scriba.events.on('doc:change', () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    // 处理最新文本
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

| 方法 | 说明 |
| --- | --- |
| `t(key, vars?)` | 按当前语言翻译；支持 `{name}` 占位符；找不到时返回 key |
| `getLanguage()` | 返回当前语言 id，如 `zh-CN`、`en-US` |
| `setLanguage(id)` | 切换界面语言 |
| `getLanguages()` | 返回可用语言列表 |
| `registerLanguage(language)` | 注册新语言；如果 id 已存在则不会覆盖 |
| `registerTranslations(languageId, translations)` | 向已有语言合并插件自己的文案 |
| `onChange(cb)` | 语言变化时回调；返回取消订阅函数 |

示例：为插件界面提供中英文

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

按插件隔离的持久化存储（`localStorage`，键会加上 `scriba-plugin:<plugin-id>:` 前缀）。

```ts
get<T>(key: string): T | undefined
set(key: string, value: unknown): void
delete(key: string): void
```

- 值使用 `JSON.stringify` / `JSON.parse` 序列化，必须可 JSON 序列化。
- 读取不存在或解析失败时返回 `undefined`。
- 存储按插件隔离，不同插件使用相同 key 不会冲突。

### 5.10 `scriba.libs`

复用应用内置的第三方库，避免插件重复打包：

```ts
scriba.libs.katex.renderToString('x^2')

const mermaid = await scriba.libs.mermaid()
```

| 成员 | 说明 |
| --- | --- |
| `libs.katex` | KaTeX 默认导出，可直接调用 `renderToString` 等 API |
| `libs.mermaid()` | 异步返回 Mermaid 默认导出；首次调用时才加载 |

### 5.11 `scriba.log`

带插件前缀的日志输出：

```js
scriba.log('loaded', { version: '1.0.0' })
// 控制台输出：[plugin:my-plugin] loaded { version: '1.0.0' }
```

---

## 6. 示例

### 6.1 命令 + 快捷键

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

### 6.2 状态栏字数统计

`manifest.json`：

```json
{
  "id": "word-count",
  "name": "Word Count",
  "version": "1.0.0",
  "main": "index.js",
  "minAppVersion": "0.1.0"
}
```

`index.js`：

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

### 6.3 侧栏面板

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

### 6.4 自定义代码块渲染器

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

### 6.5 主题

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

### 6.6 国际化

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

## 7. 调试

- 使用 `Ctrl/Cmd + Shift + I` 打开开发者工具。
- 插件异常会输出到控制台，并在界面上弹出错误提示。
- 修改插件后，在 **插件管理器 → 重新加载** 生效。
- 插件快捷键不生效时，检查是否有内置命令在「设置 → 快捷键」中占用了同一个组合键（用户绑定优先）。
- 使用 `scriba.log(...)` 输出带插件前缀的日志，便于筛选。
- 状态栏与侧栏元素是普通 DOM，可在开发者工具中直接检查。

---

## 8. 打包与发布

### 8.1 从文件夹安装

在插件管理器点击 **从文件夹安装**，选择包含 `manifest.json` 的文件夹。应用会把它复制到 `<userData>/plugins/<id>/`。

### 8.2 GitHub 主题（推荐）

1. 把插件推到公开 GitHub 仓库。
2. 给仓库添加 `scriba-plugin` 主题（Settings → Topics）。
3. 用户在插件管理器「浏览」中搜索即可看到并安装。

安装时应用下载仓库源码归档（zipball），不需要发布 Release 资产。

### 8.3 JSON 索引

适合内网、私有分发或需要人工筛选的场景。索引是一个 JSON 文件，每个条目指向一个 ZIP：

```json
{
  "version": 1,
  "plugins": [
    {
      "id": "my-plugin",
      "name": "My Plugin",
      "version": "1.0.0",
      "description": "一句话说明插件用途",
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

完整索引维护流程见 [MARKETPLACE.md](MARKETPLACE.md)。

### 8.4 ZIP 要求

插件 ZIP 必须满足：

1. 包含 `manifest.json`，可位于压缩包根目录，或某个子目录中（如 `plugin/manifest.json`）。
2. `manifest.json` 的 `id` 必须与索引条目一致。
3. 只支持 stored / deflate 压缩，不支持 ZIP64 与加密。
4. 解压后总大小不超过 64 MB，压缩包本身不超过 32 MB。
5. 不允许 `../`、绝对路径等越界条目。

### 8.5 发布步骤

完整命名规则、清单校验与发布流程见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)。

---

## 9. 安全

- 插件与应用同权限运行，可以访问 DOM、网络和本地存储。
- 插件入口不使用 `eval`，但插件代码本身没有沙箱隔离。
- 市场安装会校验清单、版本、下载地址、大小与路径穿越，但**不验证代码签名**。
- 请只安装可信来源的插件；发布插件时不要在代码中硬编码密钥或 Token。

---

## 10. 兼容性与最佳实践

### 10.1 版本兼容

- 填写 `minAppVersion`，并在 `activate` 中检测可选 API。
- 不要依赖未写入本文档的内部实现或 DOM 结构。
- 插件入口不要使用 `import` / `export`，使用 CommonJS 或纯脚本。

### 10.2 性能

- `doc:change` 可能非常频繁；重计算请做防抖。
- 状态栏与侧栏更新尽量只修改必要的 DOM。
- 代码块渲染器可能被多次调用；耗时操作请缓存或取消。
- 避免在 `activate` 中执行长时间同步阻塞。

### 10.3 清理

- 定时器、DOM 监听器、观察者、网络连接请在 `deactivate` 中清理。
- `deactivate` 定义在模块顶层，且保持同步。
- 事件订阅、贡献点与 `style.css` 会由运行时自动清理。

### 10.4 常见问题

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 插件未出现在列表 | `manifest.json` 缺失或 `id`/`name`/`version` 不合法 | 检查清单；查看插件管理器提示 |
| 插件加载失败 | `activate` 抛错、入口文件不存在、语法错误 | 打开开发者工具查看控制台 |
| 命令不出现 | 命令 id 重复、`register` 未执行 | 检查 id 与控制台警告 |
| 快捷键无效 | 组合键被内置命令的用户绑定占用，或命令不属于本插件 | 检查「设置 → 快捷键」是否占用了该组合键 |
| 样式未生效 | `style.css` 不存在或激活失败 | 确认文件存在且插件已启用 |
| 代码块渲染器不运行 | 光标仍在代码块内、语言大小写不匹配 | 移出光标；语言会统一转小写 |

---

## 11. 相关文档

- [项目与软件介绍（中文）](PROJECT.md) / [English](PROJECT.en.md)
- [插件与 API 文档（中文）](PLUGIN_API.md) / [English](PLUGIN_API.en.md)
- [插件规范与发布](PLUGIN_SPEC.md)
- [插件市场索引维护](MARKETPLACE.md)
- [贡献指南](../CONTRIBUTING.md)
- [README](../README.md)
