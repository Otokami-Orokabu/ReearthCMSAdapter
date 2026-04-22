# アーキテクチャ

本プロジェクトは **Ports & Adapters (Hexagonal Architecture)** を採用した Re:Earth CMS 統合クライアントの参照実装。同じ Core を **CLI / MCP / HTTP** の 3 つの Adapter で露出する構造の実証を目的とする。

## 全体像

```
                     ┌─ apps/cli (reearth-cms バイナリ) ──────────┐
                     │                                            │
[Terminal CLI]   ───▶│  CLI subcommands                           │
[AI (Claude etc)]    │                                            │
  └─ stdio ─────────▶│  MCP tools  (registerTool × 7)             │──▶ @hw/reearth-api-server
[Web / Unity / ...]  │                                            │       (Core / ACL)
  └─ HTTP ──────────▶│  Express HTTP routes                       │              │
                     └────────────────────────────────────────────┘              ▼
                    同じ Core を 3 プロトコルで露出                         Re:Earth CMS
```

## レイヤー責務

| レイヤー | 実装 | 役割 |
|---|---|---|
| **Primary Adapter** (駆動側: 外→内) | `apps/cli/src/commands/*` (CLI) / `apps/cli/src/adapters/mcp.ts` / `apps/cli/src/adapters/http/*` | プロトコル固有の入口。リクエスト/引数を解釈して Port を呼ぶ |
| **Primary Port** | `@hw/reearth-api-server` の `ReearthClient` 型 | Adapter が共通で叩く関数契約 |
| **Domain Core** | `@hw/reearth-api-server/src/{client,mappers,errors,filter,types}.ts` | 型変換、エラー正規化、**client-side filter/sort/slice** |
| **Secondary Port** | `@reearth/cms-api` SDK の公開型 | 外 (CMS) へ出ていく契約 |
| **Secondary Adapter** (被駆動側: 内→外) | `@hw/reearth-api-server/src/{public,features,integration,_http}.ts` | REST/JSON の具体プロトコル実装 (Public JSON / `.geojson` variant / Integration) |
| **UI (頭)** | `apps/web` (Vite+React) | Primary Adapter (HTTP) を叩く消費者の一例 |

## 依存方向 (Dependency Rule)

```
apps/web  ──(HTTP only)──▶  apps/cli (serve mode)  ──▶  @hw/reearth-api-server  ──▶  @reearth/cms-api
AI client ──(stdio MCP)──▶  apps/cli (mcp mode)    ──▶  @hw/reearth-api-server  ──▶  ...
terminal  ──(exec)──────▶  apps/cli (CLI mode)    ──▶  @hw/reearth-api-server  ──▶  ...
```

- すべて**内向き**に依存
- 逆方向 (Core が Adapter を知る) は **ESLint `no-restricted-imports` で機械的に禁止**
- これにより:
  - UI フレームワークを React → Vue に差し替えても Core は不変
  - Express を Fastify に差し替えても Core は不変
  - `@reearth/cms-api` が仕様変更しても影響は Core 内部で吸収
  - 同じ Core を CLI / バッチ / テストからも呼べる

## 設計ポリシー (SoT と重複排除)

### SoT オーナーシップ

| 情報 / 関心事 | SoT (唯一のオーナー) | 利用側 | 補足 |
|---|---|---|---|
| CMS フィールド型列挙 (`CmsFieldType`) | `packages/reearth-api-server/src/types.ts` | CLI `http/items.ts`, MCP `adapters/mcp.ts` | runtime 値は `CMS_FIELD_TYPE_VALUES` で export、TS 型は派生 |
| `ClientConfig` / `ReearthClient` 等 | 同上 | 各 adapter が import | |
| CMS Item ↔ フラット 変換 | `packages/reearth-api-server/src/mappers.ts` | Core のみが利用 | |
| **filter/sort/slice ロジック** | `packages/reearth-api-server/src/filter.ts` | Core の `public.ts` / `features.ts` が利用 | ジェネリック (extractor 渡す形)、テストあり |
| CMS URL 組み立て | `packages/reearth-api-server/src/{public,features,integration}.ts` | 外から触らない | SDK 呼出 or 自前 fetch、内部化 |
| 環境変数 → `ClientConfig` | `apps/cli/src/config.ts` | 全 subcommand・adapter が同じ `loadConfig()` を呼ぶ | `process.env` を分散参照しない |
| CLI オプションパーサ (`--bbox`, `--sort`, `--limit`) | `apps/cli/src/optParsers.ts` | CLI コマンド・HTTP `query.ts` で共有 | CLI / HTTP のフォーマットは同じ |
| HTTP ルート定義 | `apps/cli/src/adapters/http/{items,features}.ts` | web (proxy 経由) は URL 決め打ち | |
| エラー型 (`ReearthApiError`) | `packages/reearth-api-server/src/errors.ts` | 全 adapter が import、境界で catch | |

### 重複処理を出さないためのルール

- **変換関数を複数箇所に書かない** — `mappers.ts` に集約、必ずそこを呼ぶ
- **ドメイン型を adapter ごとに再定義しない** — Core の型を import、web 側は HTTP 契約の観点で最小限のみ独立定義
- **fetch / URL 組み立てを UI に書かない** — `apps/web/src/api.ts` に集約
- **env 読込を `loadConfig` 呼び出し以外でやらない** — 起動時に 1 回

## テスト戦略

| テスト対象 | 場所 |
|---|---|
| `mappers.ts` 純関数 | `packages/reearth-api-server/tests/mappers.test.ts` |
| `ReearthApiError` | `packages/reearth-api-server/tests/errors.test.ts` |
| `isCmsPayload` ランタイム検証 | `apps/cli/tests/adapters/http/items.test.ts` |
| 実 CMS 疎通 | `packages/reearth-api-server/scripts/smoke.ts` (手動実行) |
| HTTP 層 | smoke + curl (自動化 skip、小規模のため) |
| React UI | skip (最小 UI のため) |

## 育成軸 (将来拡張の原則)

新機能は **Core + MCP tool + CLI subcommand の 3 点セット**で追加する。

例 1: `publishItem` を追加した際の実作業:
1. **Core**: `ReearthClient.publishItem(model, id)` を `types.ts` と `integration.ts` に追加
2. **CLI**: `apps/cli/src/commands/publish.ts` を新設、`index.ts` で register
3. **MCP**: `apps/cli/src/adapters/mcp.ts` に `registerTool('publish_item', ...)` 追加

例 2: `listItems` の **bbox / sort フィルタ** を追加した際:
1. **Core**: `types.ts` に `Bbox` / `SortSpec` 追加、`ListOpts` 拡張、`filter.ts` で汎用関数、`public.ts` で fetch 後適用
2. **CLI**: `list` / `features` コマンドに `--bbox` / `--sort` オプション、`optParsers.ts` に文字列→型パーサ
3. **MCP**: `list_items` / `list_features` tool の `inputSchema` に bbox/sort 追加
4. **HTTP**: `/api/items/:model` / `/api/features/:model` で `?bbox=` / `?sort=` を parse

HTTP への露出は**必要になったら**足す (汎用 HTTP ルートより、専用ドメインルートを足す方針)。

## Hexagonal に収束した理由

本プロジェクトの要件を個別に見ると独立に見えるが、**同時に満たす形を探すと自動的に Hexagonal になる**:

| 要件 | 帰結する構造 |
|---|---|
| ヘッドレス CMS を使う (view が外側) | view と本体の分離 = 外側レイヤー |
| Public + Integration の両 API を使う | 外部契約を統合する場所が必要 = ACL (Domain Core) |
| CLI 的にコンポーザブルにしたい | API を画面非依存の関数群に = Primary Port |
| 再利用可能な資産として切り出したい | 独立パッケージ化 = `@hw/reearth-api-server` |
| TS で型安全を徹底したい | 境界に型契約を置く = Port の型定義 |
| 複数のクライアント (CLI / AI / Web / Unity) から呼べる | Adapter 多重化 |

「Hexagonal に合わせに行った」のではなく、**要件を満たす設計を積んだ結果が Hexagonal だった**、という扱い。命名規則は後付けの地図に過ぎない。

## 関連

- [cli.md](./cli.md), [mcp.md](./mcp.md), [http.md](./http.md) — 3 Adapter それぞれの使い方
- [quirks.md](./quirks.md) — Re:Earth CMS 固有の仕様・制約
- [../README.md](../README.md) — プロジェクト紹介・セットアップ
