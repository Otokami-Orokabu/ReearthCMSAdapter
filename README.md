# Re:Earth CMS Adapter Hub

**Re:Earth CMS Adapter Hub** — Re:Earth CMS の Public / Integration API を ACL で吸収し、**CLI / HTTP / MCP** の 3 プロトコルから同じ Core を呼び出せるようにする統合ゲートウェイ。

[reearth-cms-api](https://github.com/reearth/reearth-cms-api) を利用した参照実装で、内部は **Ports & Adapters (Hexagonal Architecture)** に沿う。

## アーキテクチャ (概要)

```
[Terminal CLI]   ───▶ ┐
[AI (Claude/Cursor)]  ├─▶ reearth-cms (apps/cli) ──▶ @hw/reearth-api-server ──▶ Re:Earth CMS
  └─ stdio (MCP) ──▶ ┤       Adapter Hub                    Core / ACL
[Web / Unity] ──HTTP─▶ ┘     (CLI / HTTP / MCP)
```

| ユーザー | 入口 | 目的 |
|---|---|---|
| 人間 | CLI (`reearth-cms <subcommand>`) | 手元からの CRUD / 疎通 / smoke |
| 機械 (Web / Unity / 他サービス) | HTTP (`reearth-cms serve`) | ACL 経由の REST |
| AI エージェント (Claude / Cursor) | MCP (`reearth-cms mcp`) | 自然言語からの item / asset 操作 |

- 3 モードは**同じ 1 バイナリ** (`reearth-cms`) のサブコマンド。`@hw/reearth-api-server` (Core) を共通の下層に置いて薄く載せている
- **CLI サブコマンドの語彙が SoT**。MCP tool 名 (snake_case) と HTTP ルート (METHOD + path) はここから 1:1 写像される (命名規則: CLI-as-Contract)
- 設計思想 / 依存方向 / SoT / 命名規則 / API カバー範囲と YAGNI 境界は **[docs/architecture.md](./docs/architecture.md)**

## ディレクトリ

```
ReearthCMS_HW/
├── .env                           # CMS 接続設定 (gitignore 済)
├── .env.example
├── packages/
│   └── reearth-api-server/        # Core / ACL (@hw/reearth-api-server)
├── apps/
│   ├── cli/                       # @hw/cli (reearth-cms バイナリ = Adapter Hub: CLI / HTTP / MCP)
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
| `CMS_INTEGRATION_TOKEN` | ✓ | Workspace Settings → Integration で発行した Bearer |
| `CMS_MODEL` | — | `smoke` スクリプト専用 (単一 `foo` / 配列 `[foo,bar]`)。CLI / MCP / HTTP は subcommand 引数やパラメータで毎回指定するため任意 |
| `PORT` | — | HTTP サーバのポート (既定 3000) |

## 起動

開発モード (CLI の HTTP サーバ + Vite web を並行起動):

```bash
npm run dev
```

- **HTTP サーバ**: http://localhost:3000 (`reearth-cms serve` を tsx watch 経由で実行)
- **Web UI**: http://localhost:5173 (Vite、`/api` を :3000 にプロキシ)

## 使い方

Adapter Hub の 3 入口:

| アダプタ | 呼び出し | 詳細 |
|---|---|---|
| **CLI** (ターミナルで直接操作) | `reearth-cms <subcommand>` | [docs/cli.md](./docs/cli.md) |
| **HTTP** (web / Unity などから) | `reearth-cms serve` | [docs/http.md](./docs/http.md) |
| **MCP** (Claude Code / AI から) | `reearth-cms mcp` | [docs/mcp.md](./docs/mcp.md) |

### CLI ちょい使い例

以降 `rcms` は `./node_modules/.bin/reearth-cms` のエイリアスとして書きます。

```bash
# モデル探索
rcms models                                  # プロジェクト内のモデル一覧
rcms model hazzrd_reports                    # フィールド一覧 (description / select 選択肢 / geo 型込み)
rcms schema hazzrd_reports | jq .            # raw JSON Schema (2020-12 + x-* 拡張)

# items 取得
rcms list hazzrd_reports                     # published のみ (Public API)
rcms list hazzrd_reports --all               # draft + published (Integration API)
rcms list hazzrd_reports --bbox 139,35,140,36 --limit 5
rcms list hazzrd_reports --near 139.77,35.68,5000 --sort createdAt:desc

# GeoJSON 直出し (MapLibre / Leaflet の data source にそのまま)
rcms features hazzrd_reports > out.geojson
rcms bbox hazzrd_reports                     # 全 Point を覆う bbox

# 書き込み
rcms create hazzrd_reports --title "手動投稿"
rcms publish hazzrd_reports <item-id>        # draft → Public に露出
rcms update <item-id> --data '{"title":{"type":"text","value":"改題"}}'
rcms delete <item-id> -y

# アセット
rcms upload --url https://example.com/p.png
rcms upload --file ./photo.jpg --content-type image/jpeg
rcms asset <asset-id>                        # 単体取得 (url / contentType 等)

# 開発支援
rcms seed hazzrd_reports --count 100         # ランダムデータ一括投入 (draft)
```

全サブコマンドの詳細は [docs/cli.md](./docs/cli.md)。

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

- Integration API で作成した item は **draft**。Public API (`list` / `get` / `features`) には `publish` 後のみ出る → draft 確認は `rcms list --all`
- `select` / `tag` フィールドは **CMS 定義済み選択肢と完全一致**必須、未登録値は 400。選択肢は `rcms model <key>` の `options` で取れる
- Public API の URL は **3 セグメント** (`/api/p/{ws}/{project}/{model}`)、公式 SDK と食い違うため自前 fetch 実装
- Public API は **public-scope プロジェクト前提で未認証アクセス**。Re:Earth CMS が Public 用トークンを発行しないため、`CMS_PUBLIC_TOKEN` / `ClientConfig.publicToken` は**意図的に非対応**。private-scope に繋ぐ要件が出たら `docs/architecture.md` の ADR 復元手順を参照
- モデルスキーマには **軽量版** (`/models/{id}`) と **リッチ版** (`/models/{id}/schema.json`、JSON Schema 2020-12 + `x-*` 拡張) の 2 系統がある。`rcms model` は両者をマージして返す

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
