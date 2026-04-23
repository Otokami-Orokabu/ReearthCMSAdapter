# CLI リファレンス (`reearth-cms`)

`apps/cli` が提供する `reearth-cms` コマンドの全サブコマンド仕様。

- CLI / MCP / HTTP の **3 モードをまとめた 1 つのバイナリ** の CLI モード
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

### `reearth-cms list <model> [--limit N] [--offset N] [--bbox ...] [--sort ...] [--json]`

指定モデルの **published items** を一覧 (Public API 経由)。フィルタ / ソート / ページングは Core で **fetch 後にクライアント側で適用** される (Public API がサーバサイドのフィルタを提供しないため)。

| オプション | 説明 |
|---|---|
| `--limit <n>` | 最大返却件数 |
| `--offset <n>` | 先頭から N 件スキップ (filter/sort 適用後) |
| `--bbox <lng1,lat1,lng2,lat2>` | 地理的バウンディングボックス内の items のみ (`item.location` が Point 前提) |
| `--sort <field[:asc\|desc]>` | `item[field]` で並べ替え (数値/日付文字列も賢く比較) |
| `--json` | 生 JSON で出力 (default は `id\ttitle`) |

**例:**
```bash
reearth-cms list hazzrd_reports
reearth-cms list hazzrd_reports --limit 5
reearth-cms list hazzrd_reports --bbox 139.5,35.5,140.0,35.9        # 東京周辺
reearth-cms list hazzrd_reports --sort title:desc
reearth-cms list hazzrd_reports --sort createdAt --limit 10 --json
```

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

### `reearth-cms features <model> [--bbox ...] [--sort ...] [--limit N] [--offset N]`

items を **GeoJSON FeatureCollection** として取得 (Public API の `.geojson` variant を利用)。CMS 側で location を持たない item は自動除外される。出力は FeatureCollection JSON (stdout)。

`sort --field id` で item ID 順、`sort --field <key>` で `properties.<key>` 順に並ぶ。

```bash
reearth-cms features hazzrd_reports > features.geojson
reearth-cms features hazzrd_reports --bbox 135,34,140,37 --limit 20
reearth-cms features hazzrd_reports --sort createdAt:desc | jq '.features | length'
```

MapLibre / Leaflet にそのまま渡せる:
```js
const fc = await (await fetch('/api/features/hazzrd_reports')).json();
map.addSource('reports', { type: 'geojson', data: fc });
```

### `reearth-cms model <id-or-key> [--json]`

単一モデルを **スキーマ付き** で取得 (Integration API)。`reearth-cms models` は一覧、こちらは詳細。

```bash
reearth-cms model hazzrd_reports
# hazzrd_reports (hazzrd_reports)
#   id: 01kpq9bhyhjzsdszb13nz6yq7q
#   fields (7):
#     title	text	タイトル
#     category	select	カテゴリ
#     location	geometryObject	位置
#     photos	asset [multiple]	写真
#     ...

reearth-cms model hazzrd_reports --json > schema.json
```

AI (MCP) や CLI ユーザーが `create_item` 前にフィールド構成を把握するのに使う。

### `reearth-cms models [--json]`

プロジェクト内の全モデルを一覧 (Integration API)。`id\tkey\tname` 形式 or JSON。

```bash
reearth-cms models
# 01kpq9bhyhjzsdszb13nz6yq7q	hazzrd_reports	hazzrd_reports
# 01kpsehqqp5773xwznd1k9c3f6	move_lob	move_lob
```

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
