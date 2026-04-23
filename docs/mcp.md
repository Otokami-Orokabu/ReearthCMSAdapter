# MCP (Model Context Protocol) モード

`reearth-cms mcp` サブコマンドは、**stdio トランスポートの MCP サーバ**を起動します。これにより Claude Code / Cursor / その他 MCP 対応 AI クライアントから、Re:Earth CMS の操作を **tool 呼び出し**として直接行えるようになります。

## 動機

本プロジェクトは **Re:Earth CMS Adapter Hub** — 同じ Core (`@hw/reearth-api-server`) を複数の Primary Adapter から呼べる構造。MCP は CLI / HTTP と並ぶ **Primary Adapter の 3 本目**で、AI エージェント向けの入口として機能します。

同じ Core を使うため、MCP tool と CLI subcommand は**一対一で対応**します (命名も揃えてある)。

## Claude Code への設定

プロジェクトルートまたは `~/.claude.json` 等に `.mcp.json`:

```json
{
  "mcpServers": {
    "reearth-cms": {
      "command": "node",
      "args": [
        "--env-file=/absolute/path/to/ReearthCMS_HW/.env",
        "/absolute/path/to/ReearthCMS_HW/node_modules/.bin/reearth-cms",
        "mcp"
      ]
    }
  }
}
```

- **`--env-file`** を必須で指定 (.env を CLI の自動探索に任せる場合は省略可だが、作業ディレクトリに依存するので明示推奨)
- `node_modules/.bin/reearth-cms` は `npm install` 後に生成される symlink

### 別のクライアント

Cursor や他の MCP 対応 IDE も類似の設定で OK。stdio トランスポートなので、MCP 対応クライアントなら基本的に動作します。

## 公開している tool 一覧

| Tool | 入力 | 説明 | API |
|---|---|---|---|
| `list_models` | — | プロジェクト内の全モデル | Integration |
| `get_model` | `model` | **単一モデルをスキーマ付きで取得**。軽量 `/models/{id}` と `schema.json` をマージしているので、`description` / `options` (select/tag 選択肢) / `geoSupportedTypes` まで同時に返る | Integration |
| `get_json_schema` | `model` | **raw JSON Schema (2020-12 + `x-` 拡張)** をそのまま返す。`get_model` では表現されない `x-*` キーを見たい時用 | Integration |
| `list_items` | `model`, `limit?`, `offset?`, `bbox?`, `near?`, `sort?` | モデルの published items 一覧。**bbox / near / sort の絞り込みに対応** | Public |
| `list_all_items` | `model`, `limit?`, `offset?`, `bbox?`, `near?`, `sort?` | **draft + published 両方**を返す。seed / create 直後の確認、draft 掃除に | Integration |
| `list_features` | `model`, `limit?`, `offset?`, `bbox?`, `near?`, `sort?` | **GeoJSON FeatureCollection** で取得 (`.geojson` variant) | Public |
| `get_bbox` | `model` | **モデル全 Point item を覆う bbox** `[lng1,lat1,lng2,lat2]`、空なら `null` | Public |
| `get_item` | `model`, `id` | 単体 item 取得 | Public |
| `create_item` | `model`, `payload` | item 作成 (draft) | Integration |
| `update_item` | `id`, `payload` | 部分更新 | Integration |
| `delete_item` | `id` | item 削除 | Integration |
| `publish_item` | `model`, `id` | draft を公開 | Integration |
| `get_asset` | `id` | 単体 asset 取得 (url / contentType など) | Integration |
| `upload_asset_by_url` | `url` | **公開 URL から asset 作成** — 返り id を item の asset 型 field に入れる | Integration |

### フィルタ・ソート引数の形

- `bbox`: `[minLng, minLat, maxLng, maxLat]` の長さ4の数値タプル (WGS-84 度)
- `near`: `{ lng: number, lat: number, radius: number }` — 中心から半径 (m) 以内 (Haversine)
- `sort`: `{ field: string, order?: 'asc' | 'desc' }`

`list_items` は `item[field]` で、`list_features` は `feature.properties[field]` (または `field: 'id'` で Feature ID) でソートします。

`CmsPayload` の形は `Record<string, { type: CmsFieldType, value: unknown }>`。`type` は
`text` / `textArea` / `markdown` / `richText` / `integer` / `number` / `bool` / `date` / `url` / `select` / `tag` / `asset` / `reference` / `geometryObject` のいずれか。

## I/O 仕様

- **stdout**: JSON-RPC 2.0 メッセージのみ (MCP SDK が占有)
- **stderr**: エラー・ログ (人間向け)
- AI 側は tool 呼び出しの結果を `content[].text` (JSON 文字列化されたドメインデータ) として受け取る

## 手動動作確認

シェルで stdin に JSON-RPC メッセージを流す形式でテスト可能:

```bash
cat <<'EOF' | ./node_modules/.bin/reearth-cms mcp
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_models","arguments":{}}}
EOF
```

期待されるレスポンス:
1. `initialize` への応答 (protocolVersion / capabilities / serverInfo)
2. `tools/list` への応答 (14 tool の JSON Schema)
3. `tools/call list_models` の結果 (モデル一覧)

## ユースケース例

- 「hazzrd_reports を 5 件取得して、CSV にして」→ AI が `list_items` → CSV 整形
- 「新しい投稿を作成、タイトル: ○○、場所: 渋谷駅」→ AI が `create_item` → `publish_item`
- 「`title` に "old" 含む item を全部 delete」→ `list_items` → AI がフィルタ → 各 `delete_item`
- 「大阪周辺 (135.4,34.5,135.6,34.8 あたり) の投稿を GeoJSON で」→ `list_features(bbox=[...])`
- 「新しい順に 20 件」→ `list_items(sort={field:'createdAt',order:'desc'}, limit=20)`
- 「まずこのモデルのフィールドを教えて」→ `get_model(model)` → 把握後に `create_item` 呼び出し
- 「渋谷駅から 2km 以内の投稿を見せて」→ `list_features(near={lng:139.7016,lat:35.6580,radius:2000})`
- 「全部入る地図の範囲ちょうだい」→ `get_bbox(model)` → 結果を `fitBounds` に
- 「さっき create した item は?」→ `list_all_items(model)` (draft 含む)
- 「この asset id 何だっけ」→ `get_asset(id)` → url / contentType 確認

## 関連

- [cli.md](./cli.md) — 同じ操作を手動で行う CLI
- [http.md](./http.md) — HTTP モード
- [quirks.md](./quirks.md) — select/tag の制約、draft/publish 分離などの注意点 (tool 呼び出し時も同様に該当)
