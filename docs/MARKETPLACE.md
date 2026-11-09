# 维护插件市场索引

这份文档说明如何发布插件、更新 `index.json`，以及索引与应用之间的约定。

> 应用**不缓存**索引：每次打开「插件管理器 → 浏览」或点「刷新列表」都会重新拉取。
> 因此推送新的 `index.json` 后，用户刷新即可看到变化，**不需要发布新版本的应用**。

## 一、市场是怎么工作的

市场不是服务，只是一个静态 JSON 文件：

```
index.json                     ← 清单，告诉应用去哪里下载
  └─ plugins[].download  ──→  xxx.zip   ← 真正的插件包
```

应用拿到索引后：解析 → 下载 ZIP → 校验 → 解压到 `<userData>/plugins/<id>/`。

所以「更新市场」= **更新那个 JSON 文件**。

## 二、仓库结构建议

```
scriba-plugins/
├── index.json                    # 由脚本生成，不要手改
├── packages/                     # 插件 ZIP（也可放 GitHub Releases）
│   ├── word-count-1.0.0.zip
│   └── reading-time-2.1.0.zip
└── plugins-src/                  # 插件源码（可选）
    ├── word-count/
    └── reading-time/
```

把 ZIP 放在 GitHub Releases 也可以——索引里的 `download` 只要是可访问的 http(s) 地址即可。

## 三、发布一个新插件

### 1. 准备插件包

ZIP 结构（`manifest.json` 在根目录，或**单一顶层文件夹**内）：

```
word-count.zip
└── word-count/
    ├── manifest.json
    ├── index.js
    └── style.css        # 可选
```

`manifest.json` 至少要有 `id`、`name`、`version`。

### 2. 上传 ZIP

放到 `packages/` 目录并提交，或上传到 Releases 拿到永久链接。

### 3. 生成索引

```bash
node scripts/build-index.mjs packages \
  --out index.json \
  --base-url https://raw.githubusercontent.com/you/scriba-plugins/main/packages
```

| 参数 | 说明 |
| --- | --- |
| `<plugins-dir>` | 存放插件 ZIP（或插件目录）的位置 |
| `--out` | 索引输出路径，默认 `<plugins-dir>/index.json` |
| `--base-url` | 拼在每个 `download` 前面的地址 |
| `--version` | 索引格式版本，默认 `1` |

脚本会：

- 从每个 ZIP 里**读出真实 manifest**，用它的 `id`/`name`/`version` 填索引
- 发现重复 `id`、缺少 manifest、ZIP 损坏时**输出警告**
- 一个插件都没找到时**拒绝写入空索引**
- 按名称排序，输出稳定的 JSON

> 因为索引字段直接来自 manifest，**不会出现「索引写 A、包里是 B」的错配**——那种情况会在安装时被拒绝。

### 4. 提交并推送

```bash
git add index.json packages/
git commit -m "add word-count plugin"
git push
```

用户刷新列表即可看到。

## 四、更新已有插件

改插件源码 → 重新打包成 ZIP（版本号要递增）→ 上传 → 重跑 `build-index.mjs` → 推送。

脚本每次都会重新读取所有 ZIP，所以索引始终反映当前 `packages/` 的真实状态。

用户侧会看到「可更新」标记，点击即可覆盖安装。

## 五、下线插件

从 `packages/` 删除对应 ZIP，重跑脚本，推送。

**注意**：这只影响新安装。已经装了的用户不受影响，插件仍在本地。若要强制停用，需要插件自身做版本校验。

## 六、自定义市场

用户可以在 **插件管理器 → 浏览 → 插件源** 填入任意索引 URL，设置会被记住。

因此：

- 企业内网可以托管私有索引
- 分叉项目可以自带索引，无需改代码
- 索引可以放在任意静态托管（GitHub Raw、对象存储、Nginx）

## 七、应用侧的校验规则

安装时应用会逐项检查，任一失败即中止并清理临时目录：

| 检查 | 失败后果 |
| --- | --- |
| `download` 必须是 http(s) | 该条目在解析阶段被丢弃 |
| 索引 ≤ 2 MB | 拒绝加载 |
| ZIP ≤ 32 MB | 拒绝下载 |
| 解压后 ≤ 64 MB | 拒绝安装（防 zip bomb） |
| 必须含 `manifest.json` | 安装失败 |
| `manifest.id` 必须等于索引 `id` | 安装失败 |
| `minAppVersion` 必须满足 | **下载前**就拒绝 |
| 条目路径不得含 `../` 或绝对路径 | 该条目被丢弃 |

## 八、已知限制

当前市场**没有**以下能力，发布前请知悉：

- **代码签名**：不验证插件来源，任何能改索引的人都能指向任意 ZIP
- **插件沙箱**：插件与应用同权限运行，可访问 DOM、网络、localStorage
- **依赖解析**：不支持「插件 A 依赖插件 B」
- **自动更新**：只提示「可更新」，需用户手动点击
- **搜索与分类**：列表是平铺的

因此索引的托管者实际上掌握着分发权，请谨慎管理仓库权限。

## 九、本地验证

推送前建议先在本地确认索引可用：

```bash
# 1. 生成索引
node scripts/build-index.mjs packages --out index.json --base-url http://127.0.0.1:8000

# 2. 起一个静态服务
python -m http.server 8000

# 3. 在应用里把「插件源」设为
#    http://127.0.0.1:8000/index.json
# 4. 刷新列表，尝试安装
```

这样能在发布前发现链接错误或打包问题。
