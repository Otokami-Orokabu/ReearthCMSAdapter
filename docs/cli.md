# CLI リファレンス (`reearth-cms`)

`apps/cli` が提供する `reearth-cms` コマンドの全サブコマンド仕様。

- **Adapter Hub** (CLI / HTTP / MCP) の CLI 入口。人間がターミナルから直接叩くときに使う
- 実体: `apps/cli/dist/index.js` (ビルド後) / `apps/cli/src/index.ts` (dev)
- 環境変数: 起動時に `./.env` / `../../.env` 等を自動探索 (詳細は [setup.md](./setup.md) は未作成、[../README.md](../README.md) 参照)

## 起動方法

```bash
# ビルド後 (node_modules 経由の symlink)
./node_modules/.bin/reearth-cms <subcommand> ...

# 開発中 (tsx で直接)
npm -w @hw/cli run dev -- <subcommand> ...
```

---

## データ操作

### `reearth-cms list <model> [--all] [--limit N] [--offset N] [--bbox ...] [--sort ...] [--json]`

指定モデルの items を一覧。**既定は Public API 経由で published のみ**。`--all` で Integration API 経由に切り替わり **draft も含む全 item** を返す。フィルタ / ソート / ページングは Core で **fetch 後にクライアント側で適用** される (API 側がサーバサイドのフィルタを提供しないため)。

| オプション | 説明 |
|---|---|
| `--all` | Integration API 経由で draft + published を返す (未指定時は published のみ) |
| `--limit <n>` | 最大返却件数 |
| `--offset <n>` | 先頭から N 件スキップ (filter/sort 適用後) |
| `--bbox <lng1,lat1,lng2,lat2>` | 地理的バウンディングボックス内の items のみ (`item.location` が Point 前提) |
| `--near <lng,lat,radius_m>` | 中心から `radius_m` メートル以内 (Haversine) |
| `--sort <field[:asc\|desc]>` | `item[field]` で並べ替え (数値/日付文字列も賢く比較) |
| `--json` | 生 JSON で出力 (default は `id\ttitle`) |

**例:**
```bash
reearth-cms list hazzrd_reports
reearth-cms list hazzrd_reports --limit 5
reearth-cms list hazzrd_reports --bbox 139.5,35.5,140.0,35.9        # 東京 bbox
reearth-cms list hazzrd_reports --near 139.7671,35.6812,50000       # 東京 50km 圏内
reearth-cms list hazzrd_reports --sort title:desc
reearth-cms list hazzrd_reports --sort createdAt --limit 10 --json
reearth-cms list hazzrd_reports --all                                # draft 確認 (seed 直後など)
reearth-cms list hazzrd_reports --all --json | jq '.[].id'           # draft id 一覧
```

フィルタ適用順: `near` → `bbox` → `sort` → `offset` → `limit` (Core で client-side 適用)。`--all` は fetch 層 (Public/Integration) を切り替えるだけで、フィルタの挙動は同じ。

### `reearth-cms get <model> <id>`

単体 item を取得 (Public API)。見つからないと 404 → stderr にメッセージ、exit 1。

```bash
reearth-cms get hazzrd_reports 01kpqcxn2z7rtwjfxwwsmxkwgd
```

### `reearth-cms create <model> [--title | --data | --file]`

Integration API で item 作成。ペイロードは 3 形式のいずれか 1 つ。

| 指定 | 形 |
|---|---|
| `--title <text>` | `{title: {type: 'text', value: <text>}}` ショートカット |
| `--data '<json>'` | インライン JSON |
| `--file <path>` | JSON ファイルから読込 |

**ペイロードの形** (CMS 要件):
```json
{
  "title": { "type": "text", "value": "Hello" },
  "location": {
    "type": "geometryObject",
    "value": { "type": "Point", "coordinates": [139.7, 35.7] }
  }
}
```

**例:**
```bash
reearth-cms create hazzrd_reports --title "手動投稿"
reearth-cms create hazzrd_reports --file payload.json
reearth-cms create hazzrd_reports --data '{"title":{"type":"text","value":"inline"}}'
```

> **Note**: 作成した item は **draft** 状態。`list` には出ない。公開は `publish` で。

### `reearth-cms update <id> [--title | --data | --file]`

既存 item の部分更新 (Integration API)。payload に含めたフィールドだけ変更。

```bash
reearth-cms update 01kpqcxn... --title "新タイトル"
```

### `reearth-cms delete <id> [-y]`

item 削除 (Integration API)。破壊的操作のため、デフォルトで y/N 確認あり。`-y` / `--yes` でスキップ。

```bash
reearth-cms delete 01kpt283ra95kgqkqxa3thgdqk       # 確認プロンプト
reearth-cms delete 01kpt283ra95kgqkqxa3thgdqk -y    # 強制
```

### `reearth-cms publish <model> <id>`

draft 状態の item を公開し、Public API (`list_items`) に出せるようにする。

```bash
reearth-cms publish hazzrd_reports 01kpt3834ehjg9gv1bkcc1qg11
```

### `reearth-cms features <model> [--bbox ...] [--near ...] [--sort ...] [--limit N] [--offset N]`

items を **GeoJSON FeatureCollection** として取得 (Public API の `.geojson` variant を利用)。CMS 側で location を持たない item は自動除外される。出力は FeatureCollection JSON (stdout)。

`sort --field id` で item ID 順、`sort --field <key>` で `properties.<key>` 順に並ぶ。

```bash
reearth-cms features hazzrd_reports > features.geojson
reearth-cms features hazzrd_reports --bbox 135,34,140,37 --limit 20
reearth-cms features hazzrd_reports --near 135.5,34.7,20000       # 大阪20km圏
reearth-cms features hazzrd_reports --sort createdAt:desc | jq '.features | length'
```

### `reearth-cms bbox <model> [--json]`

モデル内の全 Point-located item を覆う bbox を自動計算 (Public API、`.geojson` variant + minmax)。

```bash
reearth-cms bbox hazzrd_reports
# 131.36115117...,34.27396975...,139.83361987...,41.43219891...

reearth-cms bbox hazzrd_reports --json
# [131.36115117..., 34.27396975..., 139.83361987..., 41.43219891...]
```

地図を初期表示する時の `fitBounds` や、他サブコマンドの `--bbox` にそのままパイプできる形。
Point が 1 件も無ければ stderr にメッセージ + exit 1。

MapLibre / Leaflet にそのまま渡せる:
```js
const fc = await (await fetch('/api/features/hazzrd_reports')).json();
map.addSource('reports', { type: 'geojson', data: fc });
```

### `reearth-cms model <id-or-key> [--json]`

単一モデルを **スキーマ付き** で取得 (Integration API)。`reearth-cms models` は一覧、こちらは詳細。

内部で軽量版 `/models/{id}` と JSON Schema 版 `/models/{id}/schema.json` の 2 本をマージしているので、`description` / `options` (select・tag の選択肢) / `geoSupportedTypes` も同時に見える (`docs/quirks.md` §7 参照)。

```bash
reearth-cms model hazzrd_reports
# hazzrd_reports (hazzrd_reports)
#   id: 01kpq9bhyhjzsdszb13nz6yq7q
#   fields (7):
#     title	text	タイトル
#     category	select	カテゴリ
#       description: 危険の種類
#       options: road, facility, disaster, other
#     location	geometryObject	位置
#       geoSupportedTypes: POINT
#     photos	asset [multiple]	写真
#     ...

reearth-cms model hazzrd_reports --json > model.json
```

AI (MCP) や CLI ユーザーが `create_item` 前にフィールド構成を把握するのに使う。

### `reearth-cms schema <id-or-key>`

`/models/{id}/schema.json` の **raw JSON Schema (2020-12 + `x-` 拡張)** をそのまま stdout に流す。フォーム自動生成や、`CmsFieldSchema` にまだ取り込まれていない `x-*` キーを調べたい時に。

```bash
reearth-cms schema hazzrd_reports | jq '.properties.category'
# {
#   "type": "string",
#   "title": "category",
#   "description": "危険の種類",
#   "x-fieldType": "select",
#   "x-multiple": false,
#   "x-options": ["road", "facility", "disaster", "other"]
# }
```

通常は `reearth-cms model` でマージ済みの構造を見れば十分。raw が必要な時だけこちら。

### `reearth-cms models [--json]`

プロジェクト内の全モデルを一覧 (Integration API)。`id\tkey\tname` 形式 or JSON。

```bash
reearth-cms models
# 01kpq9bhyhjzsdszb13nz6yq7q	hazzrd_reports	hazzrd_reports
# 01kpsehqqp5773xwznd1k9c3f6	move_lob	move_lob
```

---

## アセット (画像等ファイル)

### `reearth-cms upload (--url <url> | --file <path>) [--name <name>] [--content-type <mime>] [--json]`

Asset (画像等のファイル) を CMS に作成 (Integration API)。2 つの方法:

| 形式 | フラグ | 動作 |
|---|---|---|
| URL 指定 | `--url <public-url>` | CMS が URL を fetch してコピー保持 |
| ローカルファイル | `--file <path>` | CLI がファイル読み込み → multipart アップロード |

オプション:
- `--name`: 保存名を上書き (default: URL 末尾 / ファイル basename)
- `--content-type`: MIME 型を上書き (default: 拡張子から推測 / CMS 判定)
- `--json`: 全 `CmsAsset` オブジェクトで出力 (default: `id\turl`)

```bash
# URL 指定
reearth-cms upload --url https://example.com/photo.png

# ローカルファイル直接
reearth-cms upload --file ./hero.jpg --content-type image/jpeg
reearth-cms upload --file ./data.csv --name daily_stats.csv
```

返却された `id` を item 作成時に `asset` 型 field に:
```bash
ASSET_ID=$(reearth-cms upload --file ./photo.png | cut -f1)
reearth-cms create hazzrd_reports --data "{
  \"title\":  { \"type\": \"text\",  \"value\": \"写真付き投稿\" },
  \"photos\": { \"type\": \"asset\", \"value\": [\"$ASSET_ID\"] }
}"
```

### `reearth-cms asset <id> [--json]`

単体アセット取得 (Integration API)。`upload` 後の id を再読み込みしたい時、item の asset field に入っている id を解決したい時に。

```bash
reearth-cms asset 01kpq9c...
# 01kpq9c...	https://assets.cms.reearth.io/...

reearth-cms asset 01kpq9c... --json
# { "id": "...", "url": "...", "contentType": "image/png", "totalSize": 12345, ... }
```

不明な id は stderr にメッセージ + exit 1。

---

## 一括作成 (開発・デモ用)

### `reearth-cms seed <model> [--count N] [--bbox ...] [--category ...] [--status ...]`

ランダムな Point location 付きの item を大量投入 (Integration API)。

| オプション | 説明 |
|---|---|
| `--count <n>` | 作成件数 (default: 10) |
| `--bbox <lng1,lat1,lng2,lat2>` | location 範囲 (default: 日本本土 130-141°E, 33-42°N) |
| `--category <list>` | カンマ区切りの選択肢からランダム付与 |
| `--status <list>` | 同上 (status field) |

**例:**
```bash
reearth-cms seed hazzrd_reports --count 100
reearth-cms seed hazzrd_reports --count 50 --bbox 139.5,35.5,139.9,35.8   # 東京周辺
reearth-cms seed hazzrd_reports --count 20 --category "disaster,other"
```

> **⚠ 注意**:
> - 作成 item は draft → `list` には出ない、`publish` が別途必要
> - `--category` / `--status` の値は **CMS モデル側の選択肢と完全一致必須**。未登録値を渡すと各件 HTTP 400。不明なら省略推奨。

---

## モード起動

### `reearth-cms mcp`

stdio トランスポートの MCP サーバを起動。AI クライアント (Claude Code, Cursor 等) 向け。詳細は [mcp.md](./mcp.md)。

### `reearth-cms serve [--port N]`

Express HTTP サーバを起動 (default :3000)。web / Unity 等 HTTP クライアント向け。詳細は [http.md](./http.md)。

| オプション | 説明 |
|---|---|
| `--port <n>` / `-p` | 待受ポート (指定なしは `PORT` 環境変数、それも無ければ 3000) |

```bash
reearth-cms serve             # :3000
reearth-cms serve --port 8080
```

---

## エラー処理

| 状況 | 出力先 | exit |
|---|---|---|
| env 設定不足 (`ConfigError`) | stderr 1行 | 1 |
| CMS からのエラー (`ReearthApiError`) | stderr 1行 (HTTP status 付き) | 1 |
| `get` で item 見つからず | stderr "not found" | 1 |
| `create`/`seed` で payload shape 不正 | stderr + バリデーションエラー | 1 |
| 想定外エラー | stderr に stack trace | 1 |
