# 插件规范与发布

本文定义 Scriba 插件的命名、清单与发布规范。**遵循这些规范，插件就能直接出现在应用内的插件市场中**——市场通过 GitHub 搜索发现插件，无需提交、无需索引文件。

## 一、市场如何发现插件

应用在 GitHub 上搜索带 `scriba-plugin` 主题（topic）的仓库：

```
topic:scriba-plugin <你的搜索词>
```

所以**发布插件只需两步**：

1. 把插件代码推到公开 GitHub 仓库
2. 给仓库加上 `scriba-plugin` 主题

没有中心索引、没有审核、没有发布流程。用户搜索即可看到并安装。

> 安装时应用下载仓库的源码归档（`zipball`），因此**不需要上传 Release 资产**。

## 二、命名规范

### 仓库名

推荐：`scriba-plugin-<插件id>`

```
scriba-plugin-word-count
scriba-plugin-reading-time
```

不带前缀也能被搜到（只要有主题），但会显示「命名不规范」标记。

### 插件 id

| 规则 | 说明 |
| --- | --- |
| 长度 | 3–64 字符 |
| 字符 | 小写字母、数字、连字符 |
| 首尾 | 必须是字母或数字 |
| 连字符 | 不能连续出现（`a--b` 非法） |
| 保留字 | `core`、`scriba`、`app`、`editor`、`system`、`settings`、`theme`、`themes`、`plugin`、`plugins`、`marketplace` |

合法示例：`word-count`、`reading-time`、`my-plugin-2`

非法示例：`WordCount`（大写）、`word_count`（下划线）、`-leading`（首字符）、`double--hyphen`、`core`（保留）

### 版本号

必须符合语义化版本：`主.次.修订`，可带预发布后缀。

合法：`1.0.0`、`0.0.1`、`1.2.3-beta.1`
非法：`1.0`、`v1.0.0`、`1`、`1.0.0.0`

## 三、清单文件

`manifest.json` 放在**仓库根目录**，或 `plugin/manifest.json`。

```json
{
  "id": "word-count",
  "name": "Word Count",
  "version": "1.0.0",
  "description": "在状态栏显示字数与字符数",
  "author": "Your Name",
  "license": "MIT",
  "homepage": "https://github.com/you/scriba-plugin-word-count",
  "main": "index.js",
  "minAppVersion": "0.1.0",
  "keywords": ["statusbar", "statistics"]
}
```

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `id` | 是 | 必须符合上面的 id 规则 |
| `name` | 是 | 显示名称，不能为空 |
| `version` | 是 | 语义化版本 |
| `description` | 否 | 一句话说明 |
| `author` | 否 | 作者 |
| `license` | 否 | SPDX 标识 |
| `homepage` | 否 | 项目地址 |
| `main` | 否 | 入口文件，默认 `index.js` |
| `minAppVersion` | 否 | 要求的最低应用版本 |
| `keywords` | 否 | 字符串数组 |
| `i18n` | 否 | 按语言覆盖 `name` / `description`，见下节 |

清单不合法的仓库会显示「不是有效插件」，并**禁用安装按钮**。

### 本地化插件名称与描述

`name` 和 `description` 是单语言字符串，在插件管理器里按原样显示。要跟随用户的界面语言，在 `i18n` 里按 BCP-47 语言标签提供翻译：

```json
{
  "id": "reading-time",
  "name": "Reading Time",
  "version": "1.1.0",
  "description": "Estimates how long the current document takes to read.",
  "i18n": {
    "zh-CN": {
      "name": "阅读时间",
      "description": "估算当前文档的阅读时长。"
    },
    "ja-JP": {
      "name": "読了時間",
      "description": "現在の文書を読むのにかかる時間を見積もります。"
    }
  }
}
```

匹配规则：

1. 先找完全一致的语言标签（`ja-JP`）
2. 再找同基础语言（`ja`）
3. 都没有就用 `name` / `description`

`name` 和 `description` 各自独立回退：某语言只写了 `name`，描述仍显示原文，不会留空。`i18n` 格式错误不会阻止安装，但会提示作者修正。

> **`name` 仍然是必填项。** 把 `i18n` 当作覆盖层，而不是替代品——这样旧版本应用和其他工具（包括 GitHub 上的仓库展示）仍能读到有意义的名字。

## 四、仓库结构

```
scriba-plugin-word-count/
├── manifest.json      # 必需，在根目录
├── index.js           # 入口
├── style.css          # 可选，自动注入
└── README.md          # 建议：说明用法
```

也可以放在子目录：

```
my-repo/
├── plugin/
│   ├── manifest.json
│   └── index.js
└── README.md
```

## 五、发布步骤

```bash
# 1. 建仓库
git init scriba-plugin-word-count
cd scriba-plugin-word-count

# 2. 写插件
cat > manifest.json <<'EOF'
{
  "id": "word-count",
  "name": "Word Count",
  "version": "1.0.0",
  "main": "index.js"
}
EOF

cat > index.js <<'EOF'
module.exports.activate = (scriba) => {
  const item = document.createElement('span')
  scriba.ui.addStatusBarItem({ id: 'word-count.item', element: item })
  scriba.events.on('doc:change', () => {
    const text = scriba.editor.getText()
    item.textContent = `${text.trim() ? text.trim().split(/\s+/).length : 0} words`
  })
}
EOF

# 3. 推送到 GitHub
git add . && git commit -m "initial"
git remote add origin git@github.com:you/scriba-plugin-word-count.git
git push -u origin main
```

**4. 在 GitHub 仓库页面添加主题**：Settings → Topics → 输入 `scriba-plugin` → Save

完成后，用户在应用内搜索 `word count` 或直接浏览即可看到。

## 六、更新插件

改代码 → 递增 `version` → push。

用户下次搜索会看到新版本；已安装用户会显示「可更新」，点击即覆盖安装。

> 因为安装的是仓库当前分支的内容，**未提交的改动不会被安装**。

## 七、安装时的校验

应用逐项检查，任一失败即中止并清理：

| 检查 | 失败表现 |
| --- | --- |
| 仓库带 `scriba-plugin` 主题 | 不会出现在搜索结果 |
| `manifest.json` 存在且合法 | 显示「不是有效插件」 |
| `id` 符合命名规则 | 同上 |
| `version` 符合 semver | 同上 |
| `minAppVersion` 满足 | 按钮禁用并提示所需版本 |
| 归档内 `manifest.id` 与预览一致 | 安装失败（防止分支在搜索后变更） |
| 路径不含 `../` 或绝对路径 | 该条目被丢弃 |
| 归档 ≤ 32 MB、解压后 ≤ 64 MB | 安装失败 |

安装写入临时目录 `<id>.installing`，校验通过后才 `rename` 到 `<id>`，因此**不会留下半装的插件**。

## 八、GitHub API 限流

未认证的 GitHub 搜索：**每分钟 10 次**。

在应用内 **插件市场 → ⚙** 填入只读 Token 可提高到 **每分钟 30 次**。Token 仅保存在本机 `<userData>/github-token.json`，只发给 GitHub。

建议给 Token 只勾选 `public_repo` 权限，无需任何写权限。

## 九、已知限制

- **无代码签名**：不验证插件来源，仓库所有者可推送任意代码
- **无沙箱**：插件与应用同权限运行，可访问 DOM、网络、localStorage
- **无依赖解析**：不支持「插件 A 依赖 B」
- **无自动更新**：只提示「可更新」，需手动点击
- **仅公开仓库**：GitHub 搜索不覆盖私有仓库

因此**只安装你信任的插件**。这一限制与 `scriba-plugin` 主题的开放性一致：任何人都能发布，也就意味着任何人都能冒充他人。

## 十、与索引方式的关系

应用仍保留 **JSON 索引** 作为备选（适合内网、私有分发、需要人工筛选的场景），相关说明见 [MARKETPLACE.md](MARKETPLACE.md)。

两种方式并存：

| 方式 | 适用场景 |
| --- | --- |
| GitHub 搜索 | 公开插件，零维护，社区发现 |
| JSON 索引 | 内网、私有、需要审核 |
