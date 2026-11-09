# Scriba

> 一款开源、可插件化的所见即所得 Markdown 编辑器。

Scriba 使用 **Electron + React + TypeScript + CodeMirror 6** 构建。它把 Markdown 语法隐藏在一层实时渲染的视图之下：光标所在行显示源码，其余内容以排版后的样子呈现。

[English](#english) · [项目介绍](docs/PROJECT.md) · [插件开发](docs/PLUGIN_API.md) · [贡献指南](CONTRIBUTING.md)

## 文档

- [项目与软件介绍](docs/PROJECT.md)（[English](docs/PROJECT.en.md)）
- [插件与 API 文档](docs/PLUGIN_API.md)（[English](docs/PLUGIN_API.en.md)）

## 功能

- **所见即所得**：标题、粗体、斜体、删除线、高亮、下划线、上标/下标、行内代码、链接、图片、引用、列表、任务列表、分隔线、脚注、`[TOC]` 目录、YAML 元数据在编辑区直接渲染
- **编辑增强**：列表按 Enter 自动续行、Backspace 删除标记、选中文字粘贴 URL 自动成链接、行内 HTML 标签自动闭合
- **表格编辑**：单元格内直接输入，右侧按钮一键加行/加列，右键菜单可插入/删除行列并设置对齐；拖动表头右边缘可调整列宽（双击恢复自动宽度）
- **图片粘贴与拖放**：截图或图片文件可直接粘贴、拖入文档，自动保存到 `assets/` 并插入链接；支持图片尺寸语法 `![alt](pic.png =200x)`、`=200x150`、`=x150`，预览与导出均生效
- **查找与替换**：`Ctrl/Cmd + F` / `Ctrl/Cmd + H` 打开浮动查找栏，支持区分大小写、全字匹配、正则表达式与全部替换
- **段落菜单**：`Ctrl/Cmd + 1`~`6` 设置标题级别、`Ctrl/Cmd + 0` 转正文、`Ctrl/Cmd + =` / `-` 提升/降低标题、引用、有序/无序/任务列表、缩进调整
- **插入菜单**：图片、表格、脚注、`[TOC]` 目录、分隔线、代码块、公式块，以及上/下插入段落
- **导出**：HTML、PDF、Word（`.doc`）、纯文本、PNG 图片、LaTeX 与 EPUB（按标题生成多级目录）；相对路径图片在导出时自动内联（EPUB 则复制进档案并重写路径）；支持直接打印
- **文件夹导出**：把整个工作区的 Markdown、图片等资源复制到目标目录（自动跳过 `node_modules`、`.git` 等，支持按扩展名筛选）
- **自定义快捷键**：设置 → 快捷键，可逐条改键、恢复默认，冲突时自动解除旧绑定
- **最近文件**：文件菜单记录最近打开的 10 个文档，可一键清除
- **状态栏统计**：实时显示光标位置、字数与字符数
- **源码模式**：`Ctrl/Cmd + /` 或状态栏按钮在实时预览与原始 Markdown 之间切换
- **数学公式**：行内 `$...$` 与块级 `$$...$$`，基于 KaTeX
- **Mermaid 图表**：` ```mermaid ` 代码块实时渲染
- **代码高亮**：基于 CodeMirror 的语言包，支持上百种语言
- **文件树 + 多标签页**：打开文件夹、新建/重命名/删除、拖拽打开文件、按名称筛选、外部修改自动同步；重命名文档时自动更新其他文件中的引用
- **全文件夹搜索**：侧栏「搜索」标签在整个工作区检索正文，按文件分组显示匹配行并高亮命中片段，支持区分大小写、全字匹配与正则，点击结果直接跳到对应行
- **导出样式模板**：把 CSS 放入 `<userData>/export-templates/`，导出 HTML / PDF / Word 时自动套用
- **命令行打开**：`scriba path/to/file.md` 或 `scriba path/to/folder`
- **大纲侧栏**：点击标题跳转，光标所在小节自动高亮
- **专注模式 / 打字机模式**
- **主题系统**：内置 Violet Night（默认，取自应用插画的紫色调）、Light、Dark、Solarized、Nord，支持用户 CSS 与插件主题
- **界面缩放**：设置 → 外观，85%–140% 调整侧栏、菜单与对话框的字号，不影响正文
- **命令面板**：`Ctrl/Cmd + P`
- **插件系统**：JS 插件可注册命令、快捷键、状态栏项、侧栏面板、代码块渲染器、主题、界面语言与翻译，并可访问编辑器 API；支持 `minAppVersion` 版本兼容检查
- **界面语言切换**：内置 English / 简体中文，在 **设置 → 外观** 或命令面板中切换；插件可扩展新语言（如[日语插件](https://github.com/hui139/scriba-plugin-japanese)）。插件可在清单里用 `i18n` 字段本地化自己的名称与描述
- **插件市场**：通过 GitHub `scriba-plugin` 主题搜索并直接安装，无需中心索引

## 快速开始

```bash
# 安装依赖（国内网络建议使用镜像）
npm install --registry=https://registry.npmmirror.com

# 如果 Electron 二进制下载失败
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install --registry=https://registry.npmmirror.com

# 开发模式
npm run dev

# 类型检查
npm run typecheck

# UI 冒烟测试（驱动真实构建产物，验证点击与输入）
npm run build && npm run smoke

# 单元测试（版本兼容与清单本地化）
npm run test:compat

# 全部测试
npm test

# 构建
npm run build

# 打包安装程序
npm run dist
```

> **关于启动时的 `libpng warning: iCCP: known incorrect sRGB profile`**
>
> 这几行提示由 Electron 内置的 Chromium 在初始化时打印，发生在应用代码执行之前，与应用图标和资源无关；已确认 `build/icon.png`、`build/icon.ico` 以及 Electron 发行目录内所有文件都不含 `iCCP` 数据块。它不影响功能。
>
> `npm run dev` / `npm run preview` 通过 `scripts/dev.mjs` 启动，只过滤这一行，其它输出原样保留。需要查看原始输出时设置 `SCRIBA_SHOW_ELECTRON_WARNINGS=1`。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/Cmd + N` | 新建文件 |
| `Ctrl/Cmd + O` | 打开文件 |
| `Ctrl/Cmd + Shift + O` | 打开文件夹 |
| `Ctrl/Cmd + S` | 保存 |
| `Ctrl/Cmd + Shift + S` | 另存为 |
| `Ctrl/Cmd + P` | 命令面板 |
| `Ctrl/Cmd + Shift + L` | 切换界面语言 |
| `Ctrl/Cmd + F` | 查找 |
| `Ctrl/Cmd + H` | 查找与替换 |
| `Ctrl/Cmd + 1`~`6` | 一级 ~ 六级标题 |
| `Ctrl/Cmd + 0` | 转为正文 |
| `Ctrl/Cmd + =` / `-` | 提升 / 降低标题级别 |
| `Ctrl/Cmd + T` | 插入表格 |
| `Ctrl/Cmd + Shift + K` | 插入代码块 |
| `Ctrl/Cmd + Shift + M` | 插入公式块 |
| `Ctrl/Cmd + Shift + Q` | 引用 |
| `Ctrl/Cmd + Shift + [` / `]` | 有序 / 无序列表 |
| `Ctrl/Cmd + ]` / `[` | 增加 / 减少缩进 |
| `Ctrl/Cmd + Enter` | 在下方插入段落 |
| `Ctrl/Cmd + Alt + P` | 打印 |
| `Ctrl/Cmd + /` | 切换源码模式 |
| `Ctrl/Cmd + \` | 切换侧边栏 |
| `Ctrl/Cmd + B` / `I` | 粗体 / 斜体 |
| `Ctrl/Cmd + U` | 下划线 |
| `Ctrl/Cmd + Shift + X` | 删除线 |
| `Ctrl/Cmd + Shift + H` | 高亮 |
| `Ctrl/Cmd + K` | 插入链接 |
| `F8` | 专注模式 |
| `F9` | 打字机模式 |

## 项目结构

```
src/
  main/             Electron 主进程（窗口、文件系统、插件目录、导出）
  preload/          安全的 contextBridge API
  renderer/         React 渲染层
    src/editor/     CodeMirror 编辑器、实时预览、数学/Mermaid 组件
    src/plugins/    插件运行时与贡献点注册表
    src/components/ 界面组件
    src/markdown/   Markdown → HTML 导出
plugins/            内置插件（阅读时间、代码块语言标签）
scripts/            开发启动器（统一 dev / preview 入口）与图标构建
docs/               插件 API 文档
```

## 图标

图标源文件是 `assets/logo-source.png`（提供方绘制的原始插画）。`scripts/build-icons.py` 由它一次生成全部产物：

```bash
npm run icons                          # build/icon.png、icon-512.png、icon.ico、应用内 logo
python scripts/preview-icon-sizes.py   # 生成 docs/images/icon-sizes.png，放大检查小尺寸
```

![各尺寸图标](docs/images/icon-sizes.png)

脚本做两件必要的事：

1. **抠底板**。源图是 RGB 无透明通道，圆角方以外的区域是纯白。Windows 按任务栏背景色合成图标，白色四角会露成白块，所以从画布四边做连通域填充得到圆角轮廓，白色外围转透明。只保留与边界连通的白色——插画内部的白色（蝴蝶结高光、星光）不会连到边界，因此不受影响。
2. **预乘 alpha 缩放**。直接缩放 RGBA 会把透明像素的颜色混进边缘产生白边，脚本先乘 alpha 再缩放、之后再除回来。

各尺寸图标由 1254 px 原图独立重采样，而不是从 1024 px 逐级缩小，所以小尺寸更锐利。

应用内欢迎页的 Logo 使用同一个脚本导出的 `src/renderer/src/assets/logo.png`（256 px），因此不会和任务栏图标不一致。

## 插件

插件放在用户数据目录的 `plugins/<plugin-id>/` 下，包含：

```
my-plugin/
  manifest.json
  index.js
  style.css      # 可选
```

`index.js` 通过 CommonJS 导出 `activate(scriba)`：

```js
module.exports.activate = (scriba) => {
  scriba.commands.register({
    id: 'my-plugin.hello',
    name: 'Say Hello',
    run: () => scriba.ui.showToast('Hello from my plugin!')
  })
}
```

完整 API（编辑器操作、命令与快捷键、状态栏、侧栏面板、代码块渲染器、主题、事件、存储、i18n）见 [docs/PLUGIN_API.md](docs/PLUGIN_API.md)（[English](docs/PLUGIN_API.en.md)）。在应用内通过 **插件 → 插件管理器** 启用、禁用或从文件夹安装插件。

### 插件市场

插件管理器内置「浏览」标签，**通过 GitHub 搜索发现插件**：给公开仓库加上 scriba-plugin 主题即可被收录，安装时直接下载仓库源码归档，无需发布 Release 或维护索引。也保留 JSON 索引方式，供内网或需要审核的场景使用。

**插件命名与发布规范见 [docs/PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md)**；索引方式的说明见 [docs/MARKETPLACE.md](docs/MARKETPLACE.md)。

## 安全说明

插件是运行在渲染进程中的普通 JavaScript，拥有与编辑器相同的权限。只安装你信任的插件。应用启用了上下文隔离，内容安全策略（CSP）中不包含 `unsafe-eval`：插件入口通过 Blob 模块加载，仅需 `script-src blob:`。插件社区上线前会补充权限声明与签名机制。

## 路线图

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

## 许可证

[MIT](LICENSE)

---

## English

Scriba is an open-source, plugin-driven WYSIWYG Markdown editor built with Electron, React, TypeScript and CodeMirror 6. It features live inline Markdown rendering (including highlights, underline, super/subscript, footnotes and `[TOC]`), editable tables with row/column and alignment menus, image paste & drop, a source code mode, KaTeX math, Mermaid diagrams, a file tree, tabs, themes, focus/typewriter modes, HTML/PDF/Word export, English/Chinese UI switching and a JavaScript plugin system.

Documentation: [Project overview](docs/PROJECT.en.md) · [Plugin & API](docs/PLUGIN_API.en.md) · [Contributing](CONTRIBUTING.md).

```bash
npm install
npm run dev
```

Plugins live in `<userData>/plugins/<id>/` with a `manifest.json` and a CommonJS `index.js` exporting `activate(scriba)`. See [docs/PLUGIN_API.en.md](docs/PLUGIN_API.en.md). Plugins can translate their own UI and switch languages through `scriba.i18n`.

Licensed under the MIT License.
