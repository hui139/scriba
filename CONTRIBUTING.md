# Contributing to Scriba

感谢你愿意为 Scriba 做出贡献！

## 开发环境

- Node.js 20+
- npm 10+
- Windows / macOS / Linux

```bash
npm install --registry=https://registry.npmmirror.com
npm run dev
```

Electron 二进制下载失败时，先设置镜像：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install --registry=https://registry.npmmirror.com
```

## 提交前检查

```bash
npm run typecheck
npm run build
```

## 代码风格

- TypeScript 严格模式
- 使用函数式 React 组件与 Hooks
- 不引入未经讨论的重型依赖
- 用户可见文案默认使用英文，文档可中英双语
- 遵循现有目录结构与命名

## 提交信息

使用简洁的祈使句，例如：

```
feat: add table of contents command
fix: prevent stale decorations after switching tabs
docs: document plugin theme variables
```

## 新增插件能力

插件 API 定义在 `src/renderer/src/plugins/types.ts`，运行时在 `src/renderer/src/plugins/runtime.ts`，贡献点注册表在 `src/renderer/src/plugins/registry.ts`。新增 API 时请同步更新 `docs/PLUGIN_API.md`、`docs/PLUGIN_API.en.md` 与示例插件。

## 许可证

提交代码即表示同意以 [MIT](LICENSE) 许可证发布。
