# 图标构建

应用图标由一张源图生成，不需要手工维护多份文件。

## 源文件

`assets/logo-source.png` —— 1254×1254，RGB，圆角方形以外的区域是纯白。

## 生成

```bash
npm run icons                          # 生成 build/icon.png、icon-512.png、icon.ico 与应用内 logo
python scripts/preview-icon-sizes.py   # 生成 docs/images/icon-sizes.png，用于检查小尺寸
```

产物：

| 文件 | 用途 |
| --- | --- |
| `build/icon.png` | 1024×1024，主进程窗口图标、macOS 与 Linux 打包 |
| `build/icon-512.png` | 512×512 |
| `build/icon.ico` | 16 / 20 / 24 / 32 / 40 / 48 / 64 / 96 / 128 / 256 共 10 档，Windows 打包 |
| `src/renderer/src/assets/logo.png` | 256×256，界面内显示 |
| `docs/images/icon-sizes.png` | 各尺寸放大对比图（文档用） |

`scripts/build-icons.py` 做两件必要的事：

**1. 抠底板。** 源图没有透明通道，圆角方以外的区域是纯白。Windows 会用任务栏背景色合成图标，白色四角会露成白块，因此需要从画布四边做连通域填充，把与边界连通的白转成透明。插画内部的白色（蝴蝶结高光、星光）不与边界连通，因此不受影响。

**2. 预乘 alpha 缩放。** 直接缩放 RGBA 会把透明像素的颜色混进边缘产生白边。脚本先乘 alpha 再缩放，之后把 alpha 除回来。

每个尺寸都从 1254 px 原图独立重采样，而不是从 1024 px 逐级缩小，因此小尺寸更锐利。

## 修改图标

替换 `assets/logo-source.png` 后运行 `npm run icons` 即可。若新图已经是带透明通道的 PNG，脚本会跳过抠图步骤。

图标为项目专属素材，版权归其作者所有，不适用项目的 MIT 许可。
