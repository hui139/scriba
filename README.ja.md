<div align="center">

<img src="docs/images/logo.png" alt="Scriba" width="112" />

# Scriba

**オープンソースでプラグイン拡張可能な WYSIWYG Markdown エディター**

Markdown の記法は組版結果の下に隠れます。カーソル行だけがソースを表示し、それ以外は仕上がりどおりに描画されます。

[![CI](https://github.com/hui139/scriba/actions/workflows/ci.yml/badge.svg)](https://github.com/hui139/scriba/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hui139/scriba?label=release)](https://github.com/hui139/scriba/releases/latest)
[![License](https://img.shields.io/github/license/hui139/scriba)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-4b5563)](#ダウンロード)

[English](README.en.md) · [简体中文](README.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

</div>

![Scriba のスクリーンショット](docs/images/screenshot.png)

## ダウンロード

<div align="center">

[![Scriba をダウンロード](https://img.shields.io/badge/%E3%83%80%E3%82%A6%E3%83%B3%E3%83%AD%E3%83%BC%E3%83%89-Scriba-6d28d9?style=for-the-badge&logo=github)](https://github.com/hui139/scriba/releases/latest)

**[⬇ 最新リリースを取得](https://github.com/hui139/scriba/releases/latest)**

</div>

過去のバージョンを含むすべてのリリース：[releases](https://github.com/hui139/scriba/releases)

| プラットフォーム | ファイル | インストール |
| --- | --- | --- |
| **Windows** 10/11 (x64) | `Scriba-<バージョン>-win-x64.exe` | インストーラーを実行 |
| **macOS**（Apple Silicon） | `Scriba-<バージョン>-mac-arm64.dmg` | 開いて Scriba を「アプリケーション」へドラッグ |
| **macOS**（Intel） | `Scriba-<バージョン>-mac-x64.dmg` | 同上 |
| **Linux** (x64) | `Scriba-<バージョン>-linux-x86_64.AppImage` | `chmod +x` してから実行 |

> **インストーラーはコード署名されていません。** 初回起動時に OS が警告を出します。
>
> - **Windows**：SmartScreen が「Windows によって PC が保護されました」と表示 →「詳細情報」→「実行」。
> - **macOS**：「開発元を確認できません」と表示 →「システム設定 → プライバシーとセキュリティ」で許可するか、アプリを右クリックして「開く」。
> - **Linux**：先に `chmod +x` で実行権限を付与してください。
>
> インストーラーは GitHub Actions がこのリポジトリのソースからビルドしています（[release.yml](.github/workflows/release.yml)）。手順を確認するか、自分でソースからビルドすることもできます。

## 機能

**執筆体験**

- 見出し、太字、斜体、取り消し線、ハイライト、下線、上付き/下付き文字、インラインコード、リンク、画像、引用、リスト、タスクリスト、水平線、脚注、`[TOC]`、YAML フロントマターを入力しながらその場で描画
- 表を直接編集：行・列の追加、右クリックで配置指定、列境界をドラッグして幅調整（ダブルクリックで自動幅に戻る）
- スクリーンショットや画像ファイルを貼り付け・ドラッグ＆ドロップすると `assets/` に保存され、リンクが自動挿入されます。`=200x` のサイズ記法にも対応
- Enter でリスト継続、Backspace で記号削除、選択文字列に URL を貼るとリンク化
- ワークスペース全体の検索、アウトラインサイドバー、タブ、最近使ったファイル、ソースモード
- 検索と置換：大文字小文字の区別、単語単位、正規表現、すべて置換
- 集中モード、タイプライターモード

**組版と書き出し**

- KaTeX による数式（インライン `$...$`、ブロック `$$...$$`）と Mermaid 図をリアルタイム描画
- HTML、PDF、Word、プレーンテキスト、PNG、LaTeX、EPUB へ書き出し（見出しから多階層の目次を生成）
- 相対パスの画像は書き出し時に自動でインライン化。EPUB は画像を書庫に同梱
- フォルダー書き出し：Markdown と画像リソースをまとめてコピー
- 書き出し用スタイルテンプレート：`<userData>/export-templates/` に CSS を置くだけ

**カスタマイズ**

- 組み込みテーマ 6 種（既定は Violet Night、アプリアイコンの配色由来）。ユーザー CSS とプラグインテーマにも対応
- インターフェースの拡大率 85%–140%、本文の文字サイズは独立して調整可能
- すべてのショートカットを変更可能。競合時は以前の割り当てが自動的に解除されます
- 表示言語：English / 简体中文。プラグインで言語を追加できます

**拡張性**

- JavaScript プラグインがコマンド、ショートカット、ステータスバー項目、サイドバーパネル、コードブロックレンダラー、テーマ、言語を登録可能
- プラグインマーケットは GitHub の `scriba-plugin` トピックで検索・インストール。中央インデックスは不要

## ソースからビルド

**Node.js 20+** と npm 10+ が必要です。

```bash
git clone https://github.com/hui139/scriba.git
cd scriba
npm ci
npm run dev
```

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発モード（ホットリロード） |
| `npm run build` | `out/` へビルド |
| `npm run typecheck` | TypeScript の型チェック |
| `npm test` | すべてのテスト（単体テスト + UI スモークテスト） |
| `npm run test:compat` | 単体テスト：バージョン互換性とマニフェストのローカライズ |
| `npm run smoke` | UI スモークテスト：実際のアプリを操作して検証 |
| `npm run dist` | 現在のプラットフォーム向けインストーラーを `release/` に作成 |
| `npm run icons` | 元画像からすべてのアイコンを再生成 |

<details>
<summary>中国本土からのネットワーク：依存関係の取得が遅い／失敗する場合</summary>

```bash
# npm 依存関係にミラーを使用
npm install --registry=https://registry.npmmirror.com

# Electron バイナリをミラー経由に（PowerShell）
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install --registry=https://registry.npmmirror.com
```

起動時に `libpng warning: iCCP: known incorrect sRGB profile` が表示される場合、これは Electron に同梱された Chromium からの出力で、アプリのコードやアイコンとは無関係です。動作に影響はありません。`SCRIBA_SHOW_ELECTRON_WARNINGS=1` を設定するとフィルターされていない出力を確認できます。

</details>

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [プロジェクト概要](docs/PROJECT.md) · [English](docs/PROJECT.en.md) | 設計判断、アーキテクチャ、実装の詳細（中国語） |
| [プラグイン API](docs/PLUGIN_API.md) · [English](docs/PLUGIN_API.en.md) | プラグインインターフェースの完全なリファレンスと例（中国語・英語） |
| [プラグイン仕様](docs/PLUGIN_SPEC.md) | 命名、マニフェスト、公開、検証の規則（中国語） |
| [マーケットプレイス](docs/MARKETPLACE.md) | GitHub 検索と JSON インデックスの 2 方式（中国語） |
| [コントリビューション](CONTRIBUTING.md) | 開発フローとコミット規約（中国語） |

## プラグイン

プラグインは `<userData>/plugins/<プラグイン ID>/` に置き、`manifest.json` と `activate(scriba)` をエクスポートする CommonJS エントリーを含めます。

```js
module.exports.activate = (scriba) => {
  scriba.commands.register({
    id: 'my-plugin.hello',
    name: 'Say Hello',
    run: () => scriba.ui.showToast('Hello from my plugin!')
  })
}
```

完全な API は [docs/PLUGIN_API.md](docs/PLUGIN_API.md) を参照してください。アプリ内の **プラグインマネージャー** で有効化・無効化・フォルダーからのインストールができます。

プラグインは配布もできます。公開リポジトリに `scriba-plugin` トピックを付けると、アプリ内のプラグインマーケットに表示されます。命名と公開の要件は [docs/PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md) を参照してください。

## プロジェクト構成

```
src/
  main/             Electron メインプロセス（ウィンドウ、ファイルシステム、プラグイン、書き出し、更新確認）
  preload/          contextBridge API
  renderer/         React レンダラー
    src/editor/     CodeMirror エディターとライブプレビュー
    src/plugins/    プラグインランタイムとコントリビューション登録
    src/components/ UI コンポーネント
    src/markdown/   Markdown → HTML（書き出し用）
plugins/            組み込みプラグイン（読了時間、コード言語ラベル）
scripts/            ランチャー、アイコンビルド、テスト
docs/               ドキュメント
```

## セキュリティ

プラグインはレンダラー内で動く通常の JavaScript で、エディターと同じ権限を持ちます。**信頼できるプラグインだけをインストールしてください。** コンテキスト分離を有効にし、コンテンツセキュリティポリシーに `unsafe-eval` を含めていません。プラグインのエントリーは Blob モジュールとして読み込むため、`script-src blob:` のみを必要とします。

現時点でプラグインの署名とサンドボックスは未実装です。既知の制限として [docs/PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md#九已知限制) に記載しています。

## ロードマップ

- [ ] バージョン履歴
- [ ] 共同編集とクラウド同期（任意）

実装済みの機能は [Releases](https://github.com/hui139/scriba/releases) とコミット履歴を参照してください。

## コントリビューション

Issue と Pull Request を歓迎します。開始前に [CONTRIBUTING.md](CONTRIBUTING.md) をお読みください。提出前に `npm run typecheck`、`npm test`、`npm run build` が通ることを確認してください。CI は Windows、macOS、Linux の 3 プラットフォームでこれらのチェックを実行します。

## ライセンス

[MIT](LICENSE) © Scriba Contributors

アプリアイコンはプロジェクト固有の素材であり、著作権はその作者に帰属します。上記の MIT ライセンスは適用されません。
