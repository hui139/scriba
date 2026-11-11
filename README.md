<div align="center">

<img src="docs/images/logo.png" alt="Scriba" width="112" />

# Scriba

**一款开源、可插件化的所见即所得 Markdown 编辑器**

把 Markdown 语法藏在排版之后：光标所在行显示源码，其余内容直接呈现排版结果。

[![CI](https://github.com/hui139/scriba/actions/workflows/ci.yml/badge.svg)](https://github.com/hui139/scriba/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hui139/scriba?label=release)](https://github.com/hui139/scriba/releases/latest)
[![License](https://img.shields.io/github/license/hui139/scriba)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-4b5563)](#下载)

[English](README.en.md) · [简体中文](README.md) · [文档](#文档) · [插件开发](docs/PLUGIN_API.md) · [贡献指南](CONTRIBUTING.md)

</div>

![Scriba 界面截图](docs/images/screenshot.png)

## 下载

<div align="center">

[![下载 Scriba](https://img.shields.io/badge/%E4%B8%8B%E8%BD%BD-Scriba-6d28d9?style=for-the-badge&logo=github)](https://github.com/hui139/scriba/releases/latest)

**[⬇ 前往 Releases 下载最新版本](https://github.com/hui139/scriba/releases/latest)**

</div>

所有版本与历史安装包：[releases](https://github.com/hui139/scriba/releases)

| 平台 | 文件 | 安装方式 |
| --- | --- | --- |
| **Windows** 10/11 (x64) | [`Scriba-<版本>-win-x64.exe`](https://github.com/hui139/scriba/releases/latest) | 双击运行安装程序 |
| **macOS** (Apple 芯片) | [`Scriba-<版本>-mac-arm64.dmg`](https://github.com/hui139/scriba/releases/latest) | 打开后把 Scriba 拖入「应用程序」 |
| **macOS** (Intel) | [`Scriba-<版本>-mac-x64.dmg`](https://github.com/hui139/scriba/releases/latest) | 同上 |
| **Linux** (x64) | [`Scriba-<版本>-linux-x86_64.AppImage`](https://github.com/hui139/scriba/releases/latest) | `chmod +x` 后直接运行 |

> **安装包未做代码签名**，首次运行时系统会拦截：
>
> - **Windows**：SmartScreen 提示「Windows 已保护你的电脑」→ 点「更多信息」→「仍要运行」。
> - **macOS**：提示无法验证开发者 → 在「系统设置 → 隐私与安全性」中允许打开，或右键应用选「打开」。
> - **Linux**：需要先 `chmod +x` 赋予可执行权限。
>
> 安装包由 GitHub Actions 从本仓库源码构建，构建过程见 [release.yml](.github/workflows/release.yml)，可自行核对或从源码构建。

## 功能

**编辑体验**

- 标题、粗体、斜体、删除线、高亮、下划线、上标/下标、行内代码、链接、图片、引用、列表、任务列表、分隔线、脚注、`[TOC]` 目录与 YAML 元数据均在编辑区实时渲染
- 表格可直接编辑：加行加列、右键设置对齐、拖动表头调整列宽（双击恢复自动宽度）
- 截图或图片文件可直接粘贴、拖入文档，自动存入 `assets/` 并插入链接；支持 `=200x` 尺寸语法
- 列表按 Enter 续行、Backspace 删除标记、选中文字粘贴 URL 自动成链接
- 全文件夹搜索、大纲侧栏、多标签页、最近文件、源码模式
- 查找与替换：区分大小写、全字匹配、正则表达式、全部替换
- 专注模式、打字机模式

**排版与导出**

- KaTeX 数学公式（行内 `$...$`、块级 `$$...$$`）与 Mermaid 图表实时渲染
- 导出 HTML、PDF、Word、纯文本、PNG、LaTeX、EPUB（按标题生成多级目录）
- 相对路径图片在导出时自动内联；EPUB 会把图片打包进档案
- 文件夹导出：连同 Markdown 与图片资源一起复制出去
- 导出样式模板：把 CSS 放进 `<userData>/export-templates/` 即可套用

**个性化**

- 6 款内置主题（默认 Violet Night，取自应用图标配色），支持用户 CSS 与插件主题
- 界面缩放 85%–140%，正文字号独立可调
- 所有快捷键均可自定义，冲突时自动解除旧绑定
- 界面语言：English / 简体中文，插件可扩展新语言

**可扩展**

- JavaScript 插件可注册命令、快捷键、状态栏项、侧栏面板、代码块渲染器、主题与语言
- 插件市场通过 GitHub `scriba-plugin` 主题直接搜索安装，无需中心索引

## 从源码构建

需要 **Node.js 20+** 与 npm 10+。

```bash
git clone https://github.com/hui139/scriba.git
cd scriba
npm ci
npm run dev
```

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发模式（热更新） |
| `npm run build` | 构建到 `out/` |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 全部测试（单元测试 + UI 冒烟测试） |
| `npm run test:compat` | 单元测试：版本兼容与清单本地化 |
| `npm run smoke` | UI 冒烟测试：驱动真实应用验证交互 |
| `npm run dist` | 打包当前平台的安装程序到 `release/` |
| `npm run icons` | 由源图重新生成全部图标 |

<details>
<summary>中国大陆网络：依赖下载缓慢或失败</summary>

```bash
# npm 依赖使用镜像
npm install --registry=https://registry.npmmirror.com

# Electron 二进制走镜像（PowerShell）
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install --registry=https://registry.npmmirror.com
```

启动时若看到 `libpng warning: iCCP: known incorrect sRGB profile`，它来自 Electron 内置的 Chromium，与应用代码和图标无关，不影响功能。设置 `SCRIBA_SHOW_ELECTRON_WARNINGS=1` 可查看未过滤的原始输出。

</details>

## 文档

| 文档 | 内容 |
| --- | --- |
| [项目介绍](docs/PROJECT.md) · [English](docs/PROJECT.en.md) | 设计取舍、架构与实现细节 |
| [插件 API](docs/PLUGIN_API.md) · [English](docs/PLUGIN_API.en.md) | 完整插件接口参考与示例 |
| [插件规范](docs/PLUGIN_SPEC.md) | 命名、清单、发布与校验规则 |
| [插件市场](docs/MARKETPLACE.md) | GitHub 搜索与 JSON 索引两种分发方式 |
| [贡献指南](CONTRIBUTING.md) | 开发流程与提交约定 |

## 插件

插件放在 `<userData>/plugins/<插件id>/`，包含 `manifest.json` 与一个导出 `activate(scriba)` 的 CommonJS 入口：

```js
module.exports.activate = (scriba) => {
  scriba.commands.register({
    id: 'my-plugin.hello',
    name: 'Say Hello',
    run: () => scriba.ui.showToast('Hello from my plugin!')
  })
}
```

完整 API 见 [docs/PLUGIN_API.md](docs/PLUGIN_API.md)。在应用内通过 **插件管理器** 启用、禁用或从文件夹安装。

插件也是分发的：给公开仓库加上 `scriba-plugin` 主题，它就会出现在应用内的插件市场中。命名与发布要求见 [docs/PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md)。

## 项目结构

```
src/
  main/             Electron 主进程（窗口、文件系统、插件、导出、更新检查）
  preload/          contextBridge API
  renderer/         React 渲染层
    src/editor/     CodeMirror 编辑器与实时预览组件
    src/plugins/    插件运行时与贡献点注册表
    src/components/ 界面组件
    src/markdown/   Markdown → HTML 导出
plugins/            内置插件（阅读时间、代码块语言标签）
scripts/            启动器、图标构建、测试
docs/               文档
```

## 安全说明

插件是运行在渲染进程中的普通 JavaScript，拥有与编辑器相同的权限，**只安装你信任的插件**。应用启用了上下文隔离；内容安全策略不含 `unsafe-eval`，插件入口通过 Blob 模块加载，仅需 `script-src blob:`。

当前阶段插件没有签名与沙箱机制，这是已知限制，详见 [docs/PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md#九已知限制)。

## 路线图

- [ ] 版本历史
- [ ] 协作与云同步（可选）

已完成的功能见 [Releases](https://github.com/hui139/scriba/releases) 与提交历史。

## 贡献

欢迎提交 Issue 与 Pull Request。开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)；提交前请确保 `npm run typecheck`、`npm test` 与 `npm run build` 均通过。CI 会在 Windows、macOS 与 Linux 三个平台运行这些检查。

## 许可证

[MIT](LICENSE) © Scriba Contributors

图标为项目专属素材，版权归其作者所有，不适用上述 MIT 许可。
