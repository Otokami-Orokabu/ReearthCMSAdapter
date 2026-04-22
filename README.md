# ReearthCMS_HW

[reearth-cms-api](https://github.com/reearth/reearth-cms-api) を利用した Re:Earth CMS クライアントの参照実装。

**Ports & Adapters (Hexagonal Architecture)** で構築し、同じ Core を **CLI / MCP / HTTP** の 3 プロトコルで露出する。

## アーキテクチャ (概要)

```
[Terminal CLI]   ───▶ ┐
[AI (Claude/Cursor)]  ├─▶ reearth-cms (apps/cli) ──▶ @hw/reearth-api-server ──▶ Re:Earth CMS
  └─ stdio (MCP) ──▶ ┤         3 モード統合                  Core / ACL
[Web / Unity] ──HTTP─▶ ┘
```

- 3 モードは**同じ 1 バイナリ** (`reearth-cms`) のサブコマンド: `reearth-cms <list|get|create|...>` / `mcp` / `serve`
- 設計思想・依存方向・SoT ポリシーの詳細は **[docs/architecture.md](./docs/architecture.md)**

## ディレクトリ

```
ReearthCMS_HW/
├── .env                           # CMS 接続設定 (gitignore 済)
├── .env.example
├── packages/
│   └── reearth-api-server/        # Core / ACL (@hw/reearth-api-server)
├── apps/
│   ├── cli/                       # @hw/cli (reearth-cms バイナリ、CLI / MCP / HTTP)
│   └── web/                       # @hw/web (Vite + React デモビューア)
└── docs/                          # 仕様・リファレンス
    ├── architecture.md
    ├── cli.md
    ├── mcp.md
    ├── http.md
    └── quirks.md
```

## 前提

- Node.js **20.6+** (推奨 24.x)
- npm **7+** (workspaces)
- Re:Earth CMS の workspace / project と Integration Token

## セットアップ

```bash
npm install
cp .env.example .env
# エディタで .env を開いて CMS の値を記入
```

### `.env` に入れる項目

| 変数 | 必須 | 説明 |
|---|---|---|
| `CMS_BASE_URL` | ✓ | CMS API のベース URL (例 `https://api.cms.reearth.io`) |
| `CMS_WORKSPACE` | ✓ | Workspace 識別子 (ID または alias) |
| `CMS_PROJECT` | ✓ | Project 識別子 (ID または alias) |
| `CMS_MODEL` | ✓ | Model 識別子。単一 (`foo`) または配列 (`[foo,bar]`) |
| `CMS_INTEGRATION_TOKEN` | ✓ | Workspace Settings → Integration で発行した Bearer |
| `CMS_PUBLIC_TOKEN` | — | Public API が private scope の場合のみ |
| `PORT` | — | HTTP サーバのポート (既定 3000) |

## 起動

開発モード (CLI の HTTP サーバ + Vite web を並行起動):

```bash
npm run dev
```

- **HTTP サーバ**: http://localhost:3000 (`reearth-cms serve` を tsx watch 経由で実行)
- **Web UI**: http://localhost:5173 (Vite、`/api` を :3000 にプロキシ)

## 使い方

| モード | コマンド | 詳細 |
|---|---|---|
| **CLI** (ターミナルで直接操作) | `reearth-cms <subcommand>` | [docs/cli.md](./docs/cli.md) |
| **MCP** (Claude Code / AI から) | `reearth-cms mcp` | [docs/mcp.md](./docs/mcp.md) |
| **HTTP** (web / Unity などから) | `reearth-cms serve` | [docs/http.md](./docs/http.md) |

### CLI ちょい使い例

```bash
# モデル一覧
./node_modules/.bin/reearth-cms models

# items を取得
./node_modules/.bin/reearth-cms list hazzrd_reports

# 投稿
./node_modules/.bin/reearth-cms create hazzrd_reports --title "テスト"

# draft を公開
./node_modules/.bin/reearth-cms publish hazzrd_reports <item-id>

# ランダムデータ 100 件投入 (開発用)
./node_modules/.bin/reearth-cms seed hazzrd_reports --count 100
```

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | HTTP サーバ + Web を並行起動 |
| `npm run build` | 全 workspace をビルド |
| `npm run typecheck` | 全 workspace を型検査 |
| `npm run lint` | ESLint (import 方向制約・TS strict) |
| `npm test` | Vitest で全テスト |
| `npm run -w @hw/reearth-api-server smoke` | 実 CMS への疎通テスト |

## 注意点 (Re:Earth CMS の既知クセ)

- Integration API で作成した item は **draft**。Public API には `publish` 後のみ表示
- `select` / `tag` フィールドは **CMS 定義済み選択肢と完全一致**必須、未登録値は 400
- Public API の URL は **3 セグメント** (`/api/p/{ws}/{project}/{model}`)、公式 SDK と食い違うため自前 fetch 実装

詳細は **[docs/quirks.md](./docs/quirks.md)**

## 技術スタック

| 領域 | 採用 |
|---|---|
| 言語 | TypeScript (strict) |
| パッケージ管理 | npm workspaces |
| CMS SDK | [`@reearth/cms-api`](https://www.npmjs.com/package/@reearth/cms-api) v0.2.0 |
| HTTP サーバ | Express 4 |
| MCP | [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk) |
| CLI | `commander` |
| フロント | React 19 + Vite 6 + MapLibre GL |
| 地図 | GSI (国土地理院) 標準タイル |
| テスト | Vitest |
| 実行 | `tsx` (dev) / `node --env-file` (prod) |

## ライセンス

本リポジトリは個人用の実装検証プロジェクトです (非公開想定)。
