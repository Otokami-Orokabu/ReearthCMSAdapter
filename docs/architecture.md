# アーキテクチャ

本プロジェクトは **Re:Earth CMS Adapter Hub** — Re:Earth CMS の Public / Integration API を ACL で吸収した Core の上に、**CLI / HTTP / MCP** の 3 つの Primary Adapter を同居させるゲートウェイ。内部構造は **Ports & Adapters (Hexagonal Architecture)** に沿う。

## 全体像

```
                     ┌─ apps/cli (reearth-cms = Adapter Hub) ─────┐
                     │                                            │
[Terminal CLI]   ───▶│  CLI subcommands                           │
[Web / Unity / ...]  │                                            │
  └─ HTTP ──────────▶│  Express HTTP routes                       │──▶ @hw/reearth-api-server
[AI (Claude etc)]    │                                            │       (Core / ACL)
  └─ stdio ─────────▶│  MCP tools  (registerTool × 12)            │              │
                     └────────────────────────────────────────────┘              ▼
                  1 バイナリに 3 Primary Adapter を同居                     Re:Earth CMS
```

## レイヤー責務

| レイヤー | 実装 | 役割 |
|---|---|---|
| **Primary Adapter** (駆動側: 外→内) | `apps/cli/src/commands/*` (CLI) / `apps/cli/src/adapters/mcp/*` / `apps/cli/src/adapters/http/*` | プロトコル固有の入口。リクエスト/引数を解釈して Port を呼ぶ |
| **Primary Port** | `@hw/reearth-api-server` の `ReearthClient` 型 | Adapter が共通で叩く関数契約 |
| **Domain Core** | `@hw/reearth-api-server/src/{client,mappers,errors,filter,validate}.ts` + `types/*.ts` | 型変換、エラー正規化、ランタイム検証 (`assertCmsPayload`)、**client-side filter/sort/slice** |
| **Secondary Port** | `@reearth/cms-api` SDK の公開型 | 外 (CMS) へ出ていく契約 |
| **Secondary Adapter** (被駆動側: 内→外) | `@hw/reearth-api-server/src/{public,features,_http}.ts` + `integration/*` | REST/JSON の具体プロトコル実装 (Public JSON / `.geojson` variant / Integration)。リソース単位で分割済み (items / models / assets / _shared) |
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
| CMS フィールド型列挙 (`CmsFieldType`) | `packages/reearth-api-server/src/types/fields.ts` | Core `validate.ts`, MCP tool schema | runtime 値は `CMS_FIELD_TYPE_VALUES` で export、TS 型は派生 |
| ドメイン型 (`ClientConfig`, `ReearthClient`, `CmsItem` …) | `packages/reearth-api-server/src/types/*.ts` (fields / items / models / assets / geo / list / client) | 各 adapter が `types.ts` barrel 経由 import | domain 毎に分割、新しい型は対応する domain ファイルに追加 |
| **`CmsPayload` ランタイム検証** | `packages/reearth-api-server/src/validate.ts` | CLI `payload.ts`, HTTP `http/items.ts` | `assertCmsPayload` / `isCmsPayload` を Core が export。MCP は zod 経由 (tool schema generation のため)。field 型列挙は `CMS_FIELD_TYPE_VALUES` 一次参照 |
| CMS Item ↔ フラット 変換 | `packages/reearth-api-server/src/mappers.ts` | Core のみが利用 | |
| **filter/sort/slice ロジック** | `packages/reearth-api-server/src/filter.ts` | Core の `public.ts` / `features.ts` が `applyListOps` 経由で利用 | ジェネリック (extractor 渡す形)、テストあり |
| Public API の URL ベース (`/api/p/{ws}/{p}`) | `packages/reearth-api-server/src/_http.ts` の `publicBaseUrl` | `public.ts` / `features.ts` | 3-segment URL の SoT (`docs/quirks.md` §4) |
| Integration API の URL ベース (`/api/{ws}/projects/{p}`) | `packages/reearth-api-server/src/integration/_shared.ts` の `integrationBaseUrl` | `integration/*.ts` | SDK 非カバー endpoint は `sendIntegrationGET/POST` 経由 |
| JSON Schema 解析 (lightweight / schema.json マージ) | `packages/reearth-api-server/src/integration/_schemaParse.ts` | `integration/models.ts` の `getModelIntegration` のみ | `getModel` が軽量版 + schema.json をマージする処理を分離 |
| 環境変数 → `ClientConfig` | `apps/cli/src/config.ts` | 全 subcommand・adapter が同じ `loadConfig()` を呼ぶ | `process.env` を分散参照しない |
| CLI オプションパーサ (`--bbox`, `--sort`, `--limit`, `--near`) | `apps/cli/src/optParsers.ts` | CLI コマンド・HTTP `query.ts` で共有。`list` / `features` は `attachListOptions()` で 5 options を一括付与 | CLI / HTTP のフォーマットは同じ |
| HTTP ルート定義 | `apps/cli/src/adapters/http/{items,features,models,assets}.ts` | web (proxy 経由) は URL 決め打ち。list 系は `_middleware.ts` の `withListOpts` ラッパで query parse + 400 応答 + async reject → next を共通化 | |
| エラー型 (`ReearthApiError`) | `packages/reearth-api-server/src/errors.ts` | 全 adapter が import、境界で catch | |

### 重複処理を出さないためのルール

- **変換関数を複数箇所に書かない** — `mappers.ts` に集約、必ずそこを呼ぶ
- **ドメイン型を adapter ごとに再定義しない** — Core の型を import、web 側は HTTP 契約の観点で最小限のみ独立定義
- **fetch / URL 組み立てを UI に書かない** — `apps/web/src/api.ts` に集約
- **env 読込を `loadConfig` 呼び出し以外でやらない** — 起動時に 1 回

### 命名規則 (CLI-as-Contract)

CLI のサブコマンド構造 (動詞 + 名詞) を **語彙の SoT** として扱う。MCP tools と HTTP routes はここから写像する:

| CLI | MCP | HTTP |
|---|---|---|
| `<verb> <noun>` | `<verb>_<noun>` (snake_case) | `<METHOD> /<noun>/...` |
| `list <model>` | `list_items` | `GET /items/:model` |
| `create <model>` | `create_item` | `POST /items/:model` |
| `model <id>` | `get_model` | `GET /models/:id` |
| `schema <id>` | `get_json_schema` | `GET /models/:id/schema.json` |
| `asset <id>` | `get_asset` | `GET /assets/:id` |

**効果**: 1 面で学んだ語彙が他面でもほぼ同じ形で通る。AI が MCP で `list_all_items` を見つけたら、CLI `list --all` と HTTP `/items/:model/all` も存在する (少なくとも似た形で) という推測が効く。新機能を足す時も **CLI の動詞から決めれば MCP/HTTP の名前が自動的に決まる**。

**アフォーダンスとシグニファイア**:
- CLI: `reearth-cms --help` と `docs/cli.md` が signifier
- MCP: **tool description が唯一の signifier** — AI は description 以外の情報を持てないため、前後の workflow (「`create_item` の後は `publish_item`」等) も description に入れる方針
- HTTP: `serve` 起動時の stdout と `docs/http.md`

**意図的な非対称 (トレードオフ)**:
- **CLI `list --all` ⇔ MCP `list_all_items`** — CLI はフラグで使い勝手を優先、MCP は別 tool にして schema と description で明示性を優先 (AI が「draft を含むモード」を独立した capability として発見できる方が選び間違いが減る)
- **CLI `upload --file` は MCP 非対応** — binary over stdio が awkward。CLI / HTTP の multipart で代替 (`docs/architecture.md` CMS API カバー範囲 §asset direct-upload と同じ境界認識)
- **CLI `seed` は CLI のみ** — 開発・デモ用のシンタクティックシュガーで、内部的には `createItem` のループ。本番 API 面ではない

**破らない運用**:
1. 新機能は **先に CLI の動詞と名詞を決める**
2. それを MCP tool 名 (snake_case) と HTTP route (METHOD + path) に 1:1 写像
3. 逆向き (MCP / HTTP の都合で語彙を決めて CLI に降ろす) はやらない
4. 非対称を作る時は **理由を明文化** (このセクションか `#CMS API カバー範囲`)

## テスト戦略

| テスト対象 | 場所 |
|---|---|
| `mappers.ts` 純関数 | `packages/reearth-api-server/tests/mappers.test.ts` |
| `ReearthApiError` | `packages/reearth-api-server/tests/errors.test.ts` |
| `filter.ts` (bbox / near / sort / slice / applyListOps) | `packages/reearth-api-server/tests/filter.test.ts` |
| `assertCmsPayload` / `isCmsPayload` / `isCmsFieldType` | `packages/reearth-api-server/tests/validate.test.ts` |
| 実 CMS 疎通 | `packages/reearth-api-server/scripts/smoke.ts` (手動実行) |
| HTTP 層 | smoke + curl (自動化 skip、小規模のため) |
| React UI | skip (最小 UI のため) |

ランタイム検証系 (`assertCmsPayload` 等) のテストは **Core 側に集約**している。CLI / HTTP の adapter は Core の SoT を import するだけなので、検証ロジック自体の重複テストは置かない。

## 育成軸 (将来拡張の原則)

新機能は **Core + MCP tool + CLI subcommand の 3 点セット**で追加する。

例 1: `publishItem` を追加した際の実作業:
1. **Core**: `ReearthClient.publishItem(model, id)` を `types/client.ts` と `integration/items.ts` に追加 (SDK 非カバーなので `sendIntegrationPOST` 経由)
2. **CLI**: `apps/cli/src/commands/publish.ts` を新設、`index.ts` で register
3. **MCP**: `apps/cli/src/adapters/mcp/items.ts` に `registerTool('publish_item', ...)` 追加

例 2: `listItems` の **bbox / sort フィルタ** を追加した際:
1. **Core**: `types/list.ts` / `types/geo.ts` に `Bbox` / `SortSpec` 追加、`ListOpts` 拡張、`filter.ts` で汎用関数、`public.ts` で fetch 後適用
2. **CLI**: `optParsers.ts` に文字列→型パーサと `attachListOptions` 登録、`list` / `features` コマンドが自動的に新オプションを受ける
3. **MCP**: `adapters/mcp/_schemas.ts` に zod schema 追加、`list_items` / `list_features` tool から参照
4. **HTTP**: `adapters/http/query.ts` に `?bbox=` / `?sort=` の parse を追加 (list 系 route は `withListOpts` 経由で自動的に享受)

例 3: 新しい CMS モデル情報 (`getJsonSchema`) を追加した際:
1. **Core**: `types/models.ts` に `CmsJsonSchema` 型、`ReearthClient.getJsonSchema` 追加、`integration/models.ts` に実装 (`sendIntegrationGET` 経由)、`integration/index.ts` で re-export
2. **CLI**: `apps/cli/src/commands/schema.ts` を新設、`index.ts` で register
3. **MCP**: `adapters/mcp/models.ts` に `registerTool('get_json_schema', ...)` 追加
4. **HTTP**: `adapters/http/models.ts` に `/:idOrKey/schema.json` ルート追加 (動的セグメントより前に宣言)

HTTP への露出は**必要になったら**足す (汎用 HTTP ルートより、専用ドメインルートを足す方針)。

## CMS API カバー範囲と YAGNI 境界

Re:Earth CMS の API surface は広いが、本プロジェクトは **具体的なユースケースがあるものだけ wrap する** 方針。「SDK に生えているから wrap する」を避ける。

### 対応済

| カテゴリ | 提供メソッド / ルート | 備考 |
|---|---|---|
| Public API (published 読み取り) | `listItems` / `getItem` / `listFeatures` / `getBounds` | 3-seg URL 自前実装 |
| Integration API Item 読み取り (draft 含む) | `listAllItems` (CLI: `list --all`, MCP: `list_all_items`, HTTP: `/api/items/:model/all`) | `seed` 後の draft 確認・publish 忘れ検出に使う |
| Integration API Item 書き込み | `createItem` / `updateItem` / `deleteItem` / `publishItem` | |
| Integration API Model 読み取り | `listModels` / `getModel` / `getJsonSchema` | `getModel` は軽量版 + `schema.json` マージ |
| Integration API Asset 書き込み | `uploadAssetByURL` / `uploadAssetFile` | multipart (小〜中サイズ) |
| Integration API Asset 読み取り (単体) | `getAsset` | upload 後の url / contentType 再取得、item の asset field id の解決 |
| Export GeoJSON | `listFeatures` (`.geojson` variant) | |

### 意図的に skip (YAGNI 境界)

「wrap が軽い = やる価値がある」ではない。**運用ユースケースが言語化できるまで追加しない**。

| 候補 | skip 理由 | 復活条件 |
|---|---|---|
| Item / Asset Comment (`commentToItem` / `commentToAsset`) | CLI / AI 経由でコメント投稿する運用が未想定 | コメント起点のワークフローが出てきた時 |
| Asset direct-upload token flow (`createAssetUpload` → `uploadToAssetUpload` → `createAssetByToken`) | 100MB+ 大容量向け。題材 (GeoJSON + 画像) では `uploadAssetFile` (multipart) で十分 | 動画 / LoD 3DTiles など大容量アセットを扱う時 |
| Explicit pagination (`getItemsPage` / `getModelsPage`) | `getAllItems` / `getAllModels` で全件取れる規模 | モデル / items が数百〜千件規模になった時 |
| Export CSV | 題材は GeoJSON 中心、CSV 出力の下流がない | 表形式での外部連携が出てきた時 |
| Comment GET / PATCH / DELETE (SDK 非カバー) | 自前 fetch + 運用未想定 | 上の「コメント投稿」復活と対で検討 |
| Model / Schema / Field CUD (SDK 非カバー) | スキーマ編集は CMS UI で行う運用 | スキーマを IaC 化したい要件が出た時 |
| Groups (SDK 非カバー) | Group 型 field を持つモデルが題材に無い | `group` 型のモデルを扱う時 |
| Webhook 受信 | 既存の 3 Primary Adapter (CLI / HTTP / MCP) はいずれも outbound (自分 → CMS)。inbound (CMS → 自分) を受ける入口は現状持たない | CMS 側イベントを拾う要件が出たら、HTTP adapter の中に webhook 用ルートを追加するか、別の inbound Primary Adapter を新設する |
| HTTP 経由の `update` / `delete` / `publish` (item の編集系) | CLI / MCP には同等操作がある。現状 Web UI は read + `create_item` しか使わないため、HTTP route を足していない (3 面対称を破っている既知の非対称) | 外部クライアント (Unity 等) が HTTP 越しに書き込む要件 or Web UI が編集機能を持つ時。CLI-as-Contract 通り PATCH/DELETE/POST ルートを追加するだけ |
| Public API の private-scope 認証 (`CMS_PUBLIC_TOKEN` / `ClientConfig.publicToken`) | 本プロジェクトは **public-scope プロジェクトを前提** に運用している。発行している token は Integration 専用で、Public API に Bearer を付ける運用モデルと矛盾するため、コードと env から意図的に除去済 | private-scope の CMS プロジェクトに接続する要件が出た時。`ClientConfig.publicToken?` 追加 → `sendPublicGET` の token 引数復活 → `apps/cli/src/config.ts` の env 読み取り追加 の 3 点で戻せる |

### 境界の原則

1. **SDK が wrap できる** かどうかは二次的 — 優先順は**ユースケース > 実装コスト**
2. skip したものも `docs/quirks.md` / このドキュメントに残し、**「なぜ skip したか」** を明記 (復活時の判断材料)
3. 新カテゴリの追加は育成軸 (Core + CLI + MCP + HTTP の 3〜4 点セット) に沿って段階的に

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
