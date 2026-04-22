# MCP (Model Context Protocol) モード

`reearth-cms mcp` サブコマンドは、**stdio トランスポートの MCP サーバ**を起動します。これにより Claude Code / Cursor / その他 MCP 対応 AI クライアントから、Re:Earth CMS の操作を **tool 呼び出し**として直接行えるようになります。

## 動機

本プロジェクトは **Ports & Adapters** で Core (`@hw/reearth-api-server`) を複数プロトコルに露出する設計。MCP は CLI / HTTP と並ぶ **Secondary Adapter の 3 本目**で、AI クライアント向けの入り口として機能します。

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
| `list_items` | `model`, `limit?`, `offset?`, `bbox?`, `sort?` | モデルの published items 一覧。**bbox / sort の絞り込みに対応** | Public |
| `list_features` | `model`, `limit?`, `offset?`, `bbox?`, `sort?` | **GeoJSON FeatureCollection** で取得 (`.geojson` variant) | Public |
| `get_item` | `model`, `id` | 単体 item 取得 | Public |
| `create_item` | `model`, `payload` | item 作成 (draft) | Integration |
| `update_item` | `id`, `payload` | 部分更新 | Integration |
| `delete_item` | `id` | item 削除 | Integration |
| `publish_item` | `model`, `id` | draft を公開 | Integration |

### フィルタ・ソート引数の形

- `bbox`: `[minLng, minLat, maxLng, maxLat]` の長さ4の数値タプル (WGS-84 度)
- `sort`: `{ field: string, order?: 'asc' | 'desc' }`

`list_items` は `item[field]` で、`list_features` は `feature.properties[field]` (または `field: 'id'` で Feature ID) でソートします。

`CmsPayload` の形は `Record<string, { type: CmsFieldType, value: unknown }>`。`type` は
`text` / `textArea` / `markdown` / `richText` / `integer` / `number` / `bool` / `date` / `url` / `select` / `tag` / `asset` / `reference` / `geometryObject` のいずれか。

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
2. `tools/list` への応答 (7 tool の JSON Schema)
3. `tools/call list_models` の結果 (モデル一覧)

## ユースケース例

- 「hazzrd_reports を 5 件取得して、CSV にして」→ AI が `list_items` → CSV 整形
- 「新しい投稿を作成、タイトル: ○○、場所: 渋谷駅」→ AI が `create_item` → `publish_item`
- 「`title` に "old" 含む item を全部 delete」→ `list_items` → AI がフィルタ → 各 `delete_item`
- 「大阪周辺 (135.4,34.5,135.6,34.8 あたり) の投稿を GeoJSON で」→ `list_features(bbox=[...])`
- 「新しい順に 20 件」→ `list_items(sort={field:'createdAt',order:'desc'}, limit=20)`

## 関連

- [cli.md](./cli.md) — 同じ操作を手動で行う CLI
- [http.md](./http.md) — HTTP モード
- [quirks.md](./quirks.md) — select/tag の制約、draft/publish 分離などの注意点 (tool 呼び出し時も同様に該当)
