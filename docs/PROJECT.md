# Scriba 项目与软件介绍

[简体中文](PROJECT.md) · [English](PROJECT.en.md)

> 一款开源、可插件化的所见即所得 Markdown 编辑器。

---

## 1. 项目概述

Scriba 是一个面向 Markdown 写作者的桌面编辑器。它把 Markdown 语法隐藏在一层实时渲染的视图之下：光标所在行显示源码，其余内容直接以排版后的样子呈现。用户无需在「源码」和「预览」之间反复切换，即可完成写作、整理、搜索与导出。

项目使用 **Electron + React + TypeScript + CodeMirror 6** 构建，采用 MIT 许可证，当前版本为 **0.1.0**。

### 1.1 设计目标

- **专注写作**：减少语法噪音，让标题、列表、表格、图片和公式在编辑区直接可见。
- **本地优先**：文档、图片、主题与插件都保存在本地，不依赖云端服务。
- **可扩展**：通过 JavaScript 插件增加命令、快捷键、状态栏项、侧栏面板、代码块渲染器、主题和界面语言。
- **开放生态**：插件可以通过 GitHub 主题或自建 JSON 索引分发，不绑定中心服务器。
- **可控安全**：渲染进程启用上下文隔离与 CSP，插件入口不使用 `eval`。

### 1.2 适用场景

- 技术文档、知识库与个人笔记
- 博客草稿、课程讲义与会议记录
- 需要 Markdown 源文件、又希望获得接近 Word 编辑体验的用户
- 希望用插件扩展编辑器能力的开发者

### 1.3 项目信息

| 项目 | 内容 |
| --- | --- |
| 名称 | Scriba |
| 版本 | 0.1.0 |
| 许可证 | MIT |
| 技术栈 | Electron、React、TypeScript、CodeMirror 6 |
| 支持平台 | Windows、macOS、Linux |
| 仓库 | <https://github.com/hui139/scriba> |
| 问题反馈 | <https://github.com/hui139/scriba/issues> |

---

## 2. 核心特性

### 2.1 所见即所得编辑

- 标题、粗体、斜体、删除线、高亮、下划线、上标/下标、行内代码、链接、图片、引用、列表、任务列表、分隔线、脚注、`[TOC]` 目录与 YAML 元数据在编辑区直接渲染。
- 光标所在行自动显示 Markdown 源码，移出后恢复渲染，兼顾精确编辑与阅读体验。
- 支持源码模式，可在实时预览与原始 Markdown 之间切换。

### 2.2 编辑效率

- 列表按 Enter 自动续行，Backspace 删除列表标记。
- 选中文字后粘贴 URL 自动生成链接。
- 行内 HTML 标签自动闭合。
- 段落菜单与快捷键覆盖标题、引用、有序/无序/任务列表、缩进等常用操作。
- 命令面板（`Ctrl/Cmd + P`）可快速执行命令。
- 可自定义快捷键，冲突时自动解除旧绑定。

### 2.3 表格编辑

- 单元格内直接输入，右侧按钮一键加行/加列。
- 右键菜单可插入/删除行列并设置对齐。
- 拖动表头右边缘调整列宽，双击恢复自动宽度。
- 列宽按文档持久化，不写入 Markdown 源文件。

### 2.4 图片处理

- 截图或图片文件可直接粘贴、拖入文档。
- 图片自动保存到文档旁的 `assets/` 目录，并插入相对路径链接。
- 支持图片尺寸语法：`![alt](pic.png =200x)`、`=200x150`、`=x150`，预览与导出一致。

### 2.5 文件与工作区

- 文件树支持打开文件夹、新建、重命名、删除、拖拽打开与按名称筛选。
- 多标签页编辑，支持外部修改自动同步。
- 重命名文档时自动更新其他文件中的引用（跳过代码块与行内代码）。
- 最近文件菜单记录最近打开的 10 个文档。
- 可选自动保存：停止输入 1 秒后写盘。
- 全文件夹正文搜索：按文件分组显示匹配行，支持区分大小写、全字匹配与正则，点击结果跳转到对应行。

### 2.6 导出与发布

- 导出 HTML、PDF、Word（`.doc`）、纯文本、PNG 图片、LaTeX 与 EPUB。
- EPUB 按标题生成多级目录，图片自动打包并重写路径。
- 导出时自动内联相对路径图片。
- 支持导出样式模板：把 CSS 放入 `<userData>/export-templates/`，导出 HTML / PDF / Word 时自动套用。
- 支持直接打印。
- 支持把整个工作区的 Markdown 与图片资源复制到目标目录，可跳过 `node_modules`、`.git` 等目录并按扩展名筛选。

### 2.7 外观与体验

- 内置主题：Violet Night（默认）、Light、Dark、Solarized Light、Solarized Dark、Nord。
- 支持用户 CSS 主题（放入 `<userData>/themes/`）与插件主题。
- 专注模式、打字机模式、行号显示、拼写检查开关。
- 界面语言：内置 English / 简体中文，可在设置、状态栏或命令面板切换；原生菜单同步翻译。

### 2.8 扩展能力

- JavaScript 插件可注册命令、快捷键、状态栏项、侧栏面板、代码块渲染器、主题、界面语言与翻译。
- 插件可以访问编辑器 API、隔离存储、KaTeX 与 Mermaid 等内置库。
- 内置插件：阅读时间、代码块语言标签。语言切换与字数统计由核心界面提供，不再作为插件重复实现。
- 插件市场支持两种分发方式：GitHub `scriba-plugin` 主题搜索，以及自建 JSON 索引。

---

## 3. 技术架构

### 3.1 技术栈

| 层次 | 技术 |
| --- | --- |
| 桌面容器 | Electron 33 |
| 界面 | React 18、TypeScript 5.6 |
| 编辑器 | CodeMirror 6 |
| 状态管理 | Zustand 5 |
| Markdown 解析 | marked 14、DOMPurify 3 |
| 数学公式 | KaTeX 0.16 |
| 图表 | Mermaid 11 |
| 文件监听 | chokidar 3 |
| 构建 | electron-vite 2、Vite 5 |
| 打包 | electron-builder 25（NSIS / DMG / AppImage） |

### 3.2 进程与模块

Scriba 采用 Electron 标准的三层结构：

```
┌──────────────────────────────────────────────┐
│ 主进程（Node.js）                            │
│ 窗口、原生菜单、文件系统、导出、插件扫描、IPC │
└──────────────────────┬───────────────────────┘
                       │ contextBridge（preload）
┌──────────────────────▼───────────────────────┐
│ 渲染进程（React + TypeScript）               │
│  ├─ CodeMirror 6 编辑器与实时预览            │
│  ├─ 文件树、标签页、搜索、设置、插件管理器    │
│  ├─ 插件运行时与贡献点注册表                  │
│  └─ Markdown → HTML 导出                     │
└──────────────────────────────────────────────┘
```

- **主进程**：负责窗口生命周期、原生菜单、文件读写、文件夹监听、导出（HTML/PDF/Word/EPUB 等）、插件目录扫描与安装、GitHub / JSON 索引市场。
- **preload**：通过 `contextBridge` 暴露受控的 `window.api`，渲染层不直接接触 Node.js。
- **渲染进程**：承载 React 界面与 CodeMirror 编辑器；插件也在此进程中运行。

### 3.3 实时预览原理

实时预览基于 CodeMirror 6 的装饰（Decoration）与 Widget：

1. Markdown 文档由 CodeMirror 解析为语法树。
2. 光标不在某个语法节点内时，插件用 Widget 替换对应的标记或整块内容。
3. 标题、列表、表格、图片、公式、Mermaid 等由专门的 Widget 渲染。
4. 光标进入节点后恢复源码显示，保证可以精确编辑。
5. 代码块在光标离开时可由内置或插件渲染器接管。

### 3.4 插件运行时

插件系统由三部分组成：

- **主进程扫描**：读取 `<userData>/plugins/<id>/` 与内置 `plugins/<id>/` 中的 `manifest.json`、入口文件与 `style.css`。
- **渲染进程加载**：把 CommonJS 入口包裹进兼容层，通过 Blob 模块执行，避免 `eval` 与 `unsafe-eval`。
- **贡献点注册表**：统一管理命令、快捷键、状态栏项、侧栏面板、主题与代码块渲染器；禁用插件时自动移除其贡献。

详细接口见 [插件与 API 文档](PLUGIN_API.md)。

### 3.5 构建与打包

- `electron-vite` 分别构建主进程、preload 与渲染进程，输出到 `out/`。
- `electron-builder` 读取 `electron-builder.yml`，把 `out/**/*`、`plugins/**/*` 与 `package.json` 打包进安装包。
- Windows 生成 NSIS 安装程序（x64），macOS 生成 DMG，Linux 生成 AppImage。
- 应用使用 asar 打包；内置插件随应用一起分发。

### 3.6 安全模型

- 渲染进程启用上下文隔离，preload 只暴露白名单 API。
- CSP 不包含 `unsafe-eval`；插件入口通过 Blob 模块加载，仅需 `script-src blob:`。
- 插件与应用同权限运行，可以访问 DOM、网络与 `localStorage`，因此**只应安装可信来源的插件**。
- 插件市场安装流程会校验清单、版本、下载地址、压缩包大小与路径穿越；但仍不验证代码签名。

---

## 4. 目录结构

```
Scriba/
├─ src/
│  ├─ main/                 Electron 主进程
│  │  ├─ index.ts           应用入口、窗口与生命周期
│  │  ├─ menu.ts            原生菜单
│  │  ├─ ipc/               IPC 处理器（文件、插件、应用）
│  │  └─ export/            导出与插件市场实现
│  ├─ preload/              contextBridge API
│  ├─ renderer/             React 渲染层
│  │  └─ src/
│  │     ├─ editor/         CodeMirror 编辑器、实时预览、Widget
│  │     ├─ plugins/        插件运行时与贡献点注册表
│  │     ├─ components/     界面组件
│  │     ├─ markdown/       Markdown → HTML / EPUB / Word 导出
│  │     ├─ i18n/           界面语言与翻译
│  │     ├─ shortcuts/      快捷键定义与持久化
│  │     ├─ store/          设置、工作区与 UI 状态
│  │     └─ styles/         全局、编辑器与主题样式
│  └─ shared/               主进程与渲染进程共享的类型与工具
├─ plugins/                 内置插件
├─ docs/                    项目与插件文档
├─ scripts/                 开发启动器、图标与索引构建脚本
├─ assets/                  图标源文件
├─ build/                   打包资源（图标等）
├─ electron-builder.yml     打包配置
├─ electron.vite.config.ts  构建配置
└─ package.json
```

---

## 5. 安装与运行

### 5.1 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- Windows / macOS / Linux

### 5.2 安装依赖

```bash
npm install
```

国内网络可使用镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

如果 Electron 二进制下载失败：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install --registry=https://registry.npmmirror.com
```

### 5.3 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发模式 |
| `npm run preview` | 预览已构建产物 |
| `npm run typecheck` | 运行 TypeScript 类型检查 |
| `npm run build` | 构建主进程、preload 与渲染进程 |
| `npm run smoke` | 运行 UI 冒烟测试（需先构建） |
| `npm run pack` | 构建并生成未安装的应用目录 |
| `npm run dist` | 构建并生成安装程序 |
| `npm run icons` | 生成应用图标 |
| `npm run index` | 生成插件市场索引 |

### 5.4 打包

```bash
npm run dist
```

产物输出到 `release/`。Windows 默认生成 NSIS 安装程序，macOS 生成 DMG，Linux 生成 AppImage。

---

## 6. 使用指南

### 6.1 打开文件或文件夹

- 使用「文件 → 打开文件」或 `Ctrl/Cmd + O` 打开单个 Markdown 文件。
- 使用「文件 → 打开文件夹」或 `Ctrl/Cmd + Shift + O` 打开工作区。
- 也可以把文件或文件夹拖入窗口。
- 打包后的应用支持命令行打开：`scriba path/to/file.md` 或 `scriba path/to/folder`。

### 6.2 编辑与预览

- 默认进入实时预览模式；光标所在行显示源码。
- 使用 `Ctrl/Cmd + /` 或状态栏按钮切换源码模式。
- 状态栏实时显示光标位置、字数与字符数。
- `F8` 进入专注模式，`F9` 进入打字机模式。

### 6.3 表格

- 在单元格中直接输入。
- 使用表格右侧按钮增加行或列。
- 右键单元格或表头可插入/删除行列、设置对齐。
- 拖动表头右边缘调整列宽，双击恢复自动宽度。

### 6.4 图片

- 直接粘贴截图或拖入图片文件。
- 图片保存到文档旁的 `assets/` 目录，并插入相对路径。
- 使用 `=宽x高` 语法控制显示尺寸，例如 `![logo](assets/logo.png =200x)`。

### 6.5 查找与搜索

- `Ctrl/Cmd + F` 打开查找栏，`Ctrl/Cmd + H` 打开查找与替换。
- 支持区分大小写、全字匹配、正则表达式与全部替换。
- 侧栏「搜索」标签可在整个工作区检索正文，结果按文件分组并高亮命中片段。

### 6.6 导出

- 「文件 → 导出」支持 HTML、PDF、Word、纯文本、PNG、LaTeX 与 EPUB。
- 导出样式模板放在 `<userData>/export-templates/`。
- 相对路径图片在导出时自动内联；EPUB 会把图片打包进档案。

### 6.7 主题、语言与快捷键

- 设置 → 外观：切换主题、字体、行号、专注模式等。
- 设置 → 编辑器：自动保存、自动配对、拼写检查等。
- 设置 → 快捷键：逐条改键、恢复默认。
- 界面语言可在设置、状态栏或命令面板切换，快捷键为 `Ctrl/Cmd + Shift + L`。

### 6.8 插件管理

- 打开「插件 → 插件管理器」查看已安装插件。
- 支持启用/禁用、重新加载、从文件夹安装、卸载用户插件。
- 「浏览」标签可搜索 GitHub 上的插件，或使用自定义 JSON 索引。
- 内置插件随应用分发，不能卸载。

---

## 7. 数据与配置位置

Scriba 使用 Electron 的 `userData` 目录保存用户数据。常见内容如下：

| 路径 | 内容 |
| --- | --- |
| `<userData>/plugins/` | 用户安装的插件 |
| `<userData>/themes/` | 用户 CSS 主题 |
| `<userData>/export-templates/` | 导出样式模板 |
| `<userData>/plugins-state.json` | 插件启用/禁用状态 |
| `<userData>/recent-files.json` | 最近打开的文件列表 |
| `<userData>/github-token.json` | 可选的 GitHub 只读 Token |
| `<工作区>/assets/` | 粘贴或拖入的图片 |

插件可以通过 `scriba.storage` 使用按插件隔离的 `localStorage`；主题与导出模板则直接读取上述目录。

---

## 8. 插件体系

插件是一个包含 `manifest.json` 与入口脚本的文件夹，入口使用 CommonJS 风格导出 `activate(scriba)`。插件可以：

- 注册命令与快捷键
- 添加状态栏项与侧栏面板
- 注册自定义代码块渲染器
- 注册主题
- 注册界面语言与翻译
- 监听文件打开、保存、文档变化、编辑器就绪与工作区变化
- 使用编辑器 API、隔离存储、KaTeX 与 Mermaid

完整接口、生命周期、示例与发布流程见：

- [插件与 API 文档（中文）](PLUGIN_API.md)
- [Plugin & API Documentation (English)](PLUGIN_API.en.md)
- [插件规范与发布](PLUGIN_SPEC.md)
- [插件市场索引维护](MARKETPLACE.md)

> 安全提示：插件与应用同权限运行，可以访问 DOM、网络与本地存储。请只安装可信来源的插件。

---

## 9. 开发与贡献

### 9.1 提交前检查

```bash
npm run typecheck
npm run build
```

### 9.2 代码风格

- TypeScript 严格模式
- 函数式 React 组件与 Hooks
- 不引入未经讨论的重型依赖
- 用户可见文案默认使用英文，文档可中英双语
- 遵循现有目录结构与命名

### 9.3 提交信息

使用简洁的祈使句，例如：

```
feat: add table of contents command
fix: prevent stale decorations after switching tabs
docs: document plugin theme variables
```

### 9.4 修改插件 API

插件 API 定义在 `src/renderer/src/plugins/types.ts`，运行时在 `src/renderer/src/plugins/runtime.ts`，贡献点注册表在 `src/renderer/src/plugins/registry.ts`。新增 API 时请同步更新中英文插件文档与示例插件。

更多约定见 [CONTRIBUTING.md](../CONTRIBUTING.md)。

---

## 10. 路线图

- [x] 插件市场（JSON 索引 + 一键安装，索引地址可自定义）
- [x] 表格可视化编辑（单元格编辑、增删行列、右键对齐）
- [x] 自动保存（可开关，改动后 1 秒写盘）
- [ ] 版本历史
- [x] 中英文界面切换（插件可通过 `scriba.i18n` 扩展语言）
- [x] Word 导出
- [x] 纯文本导出与打印
- [x] 图片（PNG）与 LaTeX 导出
- [x] 导出时自动内联相对路径图片
- [x] 查找与替换（区分大小写、全字匹配、正则、全部替换）
- [x] 段落与插入菜单（标题快捷键、列表、脚注、TOC 等）
- [x] 最近文件
- [x] 全文件夹正文搜索（按文件分组、跳转到行）
- [x] 图片尺寸语法（`=WxH`，预览与导出一致）
- [x] 搜索结果命中片段高亮
- [x] 导出样式模板（`export-templates/*.css`）
- [x] EPUB 导出（EPUB 3，图片自动打包进档案，按标题生成多级目录）
- [x] 重命名时自动更新引用（跳过代码块与行内代码）
- [x] 表格列宽拖拽调整（按文档持久化，不污染 Markdown 源）
- [x] 编辑增强：列表续行、粘贴 URL 成链接、HTML 标签自动闭合
- [x] 自定义快捷键（设置中逐条改键，冲突自动解除）
- [x] 文件夹导出（含 Markdown 与图片资源）
- [x] 拼写检查开关（默认关闭；自动选择可用词典，中文系统回退到英文词典）
- [ ] 协作与云同步（可选）

---

## 11. 许可证

Scriba 以 [MIT 许可证](../LICENSE) 发布。

---

## 12. 相关文档

- [README](../README.md)
- [项目与软件介绍（中文）](PROJECT.md) / [English](PROJECT.en.md)
- [插件与 API 文档（中文）](PLUGIN_API.md) / [English](PLUGIN_API.en.md)
- [插件规范与发布](PLUGIN_SPEC.md)
- [插件市场索引维护](MARKETPLACE.md)
- [贡献指南](../CONTRIBUTING.md)
