# HTTP モード (`reearth-cms serve`)

`reearth-cms serve` は Express ベースの HTTP サーバを起動し、Re:Earth CMS の Read/Write 操作を REST として露出します。web フロント (`apps/web`) や Unity / モバイルアプリ / 他のバックエンドなどが叩けます。

## 起動

```bash
reearth-cms serve                # デフォルト :3000 (または PORT env)
reearth-cms serve --port 8080
```

`apps/web` の Vite 開発サーバは `/api/*` を `http://localhost:3000` にプロキシするため、**Vite + HTTP サーバを 1 コマンドで同時起動するには** リポジトリルートの `npm run dev` を使う (concurrently で serve + web が並列起動する)。

## エンドポイント一覧

| Method | Path | 内容 | 内部呼び出し |
|---|---|---|---|
| `GET` | `/api/health` | ヘルスチェック | — |
| `GET` | `/api/items/:model` | モデルの published items 一覧 (query filter 可) | Public API |
| `GET` | `/api/items/:model/:id` | 単体 item 取得 | Public API |
| `POST` | `/api/items/:model` | item 作成 (draft) | Integration API |
| `GET` | `/api/features/:model` | **GeoJSON FeatureCollection** (`.geojson` variant) | Public API |
| `GET` | `/api/models` | プロジェクト内の全モデル一覧 | Integration API |
| `GET` | `/api/models/:idOrKey` | モデル詳細 (fields スキーマ込み) | Integration API |

現時点で `update` / `delete` / `publish` は **HTTP に露出していません** (CLI・MCP からのみ利用可能)。必要性が生じたら追加します。

### 共通クエリパラメータ (`list` / `features` で使える)

| param | 形式 | 説明 |
|---|---|---|
| `limit` | 正の整数 | 最大返却件数 |
| `offset` | 非負整数 | filter/sort 後に先頭 N 件スキップ |
| `bbox` | `lng1,lat1,lng2,lat2` | 地理的バウンディングボックスで絞り込み |
| `sort` | `field` または `field:asc\|desc` | 並び替え |

不正なパラメータは **400 Bad Request** に明確なメッセージで落ちる。

## リクエスト / レスポンス

### `GET /api/health`
```bash
$ curl http://localhost:3000/api/health
{"status":"ok"}
```

### `GET /api/items/:model`

```bash
# シンプル
$ curl http://localhost:3000/api/items/hazzrd_reports
{ "items": [ { "id": "01kpqcxn...", "title": "...", "location": {...}, ... } ] }

# bbox で絞り込み (関東だけ)
$ curl "http://localhost:3000/api/items/hazzrd_reports?bbox=139,35,141,36"

# 新しい順 10 件
$ curl "http://localhost:3000/api/items/hazzrd_reports?sort=createdAt:desc&limit=10"

# 組み合わせ
$ curl "http://localhost:3000/api/items/hazzrd_reports?bbox=135,34,140,37&sort=title&limit=50"
```

Items は **flat 構造** (Public API が既に flat で返す)。`location` は GeoJSON Point、`photos` は Asset 配列 (`id` + `url`)。

### `GET /api/features/:model`

GeoJSON FeatureCollection として取得。`.geojson` variant 経由のため **location なし item は CMS 側で除外**される。

```bash
$ curl http://localhost:3000/api/features/hazzrd_reports
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "01kpqcxn...",
      "geometry": { "type": "Point", "coordinates": [136.8995, 35.15975] },
      "properties": { "title": "...", "category": "...", ... }
    }
  ]
}
```

レスポンスの `Content-Type` は `application/geo+json` (MapLibre / Leaflet / Mapbox が直接消費可能)。

同じ `bbox` / `sort` / `limit` / `offset` クエリが使える:
```bash
# 大阪周辺 + タイトル降順 + 上位 30 件
$ curl "http://localhost:3000/api/features/hazzrd_reports?bbox=135.3,34.5,135.8,34.9&sort=title:desc&limit=30"
```

### `GET /api/models` / `GET /api/models/:idOrKey`

```bash
$ curl http://localhost:3000/api/models
{ "models": [ { "id": "...", "key": "hazzrd_reports", "name": "..." }, ... ] }

$ curl http://localhost:3000/api/models/hazzrd_reports
{
  "id": "01kpq9b...",
  "key": "hazzrd_reports",
  "name": "hazzrd_reports",
  "fields": [
    { "id": "...", "key": "title", "name": "タイトル", "type": "text", "required": false, "multiple": false },
    { "id": "...", "key": "location", "name": "位置", "type": "geometryObject", ... },
    ...
  ]
}
```

不明な model は 404 (`{"error":"Not Found"}`)。

**MapLibre で直接使う例:**
```js
map.addSource('reports', {
  type: 'geojson',
  data: '/api/features/hazzrd_reports?bbox=139.5,35.5,140,35.9',
});
map.addLayer({
  id: 'reports-layer',
  type: 'circle',
  source: 'reports',
  paint: { 'circle-radius': 6, 'circle-color': '#e74c3c' },
});
```

### `GET /api/items/:model/:id`
```bash
$ curl http://localhost:3000/api/items/hazzrd_reports/01kpqcxn...
{ "id": "01kpqcxn...", "title": "...", ... }

$ curl -w "%{http_code}\n" http://localhost:3000/api/items/hazzrd_reports/unknown-id
404 → {"error":"Not Found"}
```

### `POST /api/items/:model`

リクエスト body は `CmsPayload` 形式 (`Record<string, { type, value }>`):

```bash
$ curl -X POST http://localhost:3000/api/items/hazzrd_reports \
    -H "Content-Type: application/json" \
    -d '{"title":{"type":"text","value":"new report"}}'
{ "id": "01kpt...", "createdAt": "...", "updatedAt": "...", "title": "new report" }
```

不正な payload は 400:
```bash
$ curl -X POST http://localhost:3000/api/items/hazzrd_reports \
    -H "Content-Type: application/json" \
    -d '{"title":"bare string"}'
→ 400 {"error":"Invalid payload shape. Expected Record<string, { type: CmsFieldType; value: unknown }>."}
```

> **Note**: 作成 item は **draft** 状態。Public API (`GET /api/items/:model`) の一覧には**出てこない**。公開は CLI の `reearth-cms publish <model> <id>` または MCP の `publish_item` tool で。

## エラーレスポンス仕様

| HTTP | 意味 | body 例 |
|---|---|---|
| 400 | payload shape 不正 | `{"error":"Invalid payload shape. ..."}` |
| 404 | item 見つからず | `{"error":"Not Found"}` |
| 401 | 認証失敗 (CMS 側) | `{"error":"..."}` (`ReearthApiError` がそのまま) |
| 500 | サーバ内部エラー | `{"error":"Internal Server Error"}` |

**設計方針**: CMS / SDK のエラー形をそのままフロントに漏らさず、`ReearthApiError` を中間層で HTTP ステータスに正規化。web / Unity は常に `{error: string}` 形式だけ期待すれば OK。

## CORS

サーバは `cors()` を使って**全 Origin 許可** (開発用)。本番ではリクエスト Origin を絞るミドルウェア設定が必要。

## 認証

現在 **無認証** (Integration token はサーバプロセス内部で保持、公開されない)。ローカル開発 / 信頼ドメイン運用用途のみの想定。

不特定アクセスを許容する本番運用が必要な場合は:
- API キー middleware を `adapters/http/app.ts` の `app.use` 前段に挿入
- `.env` にサーバ公開用 key を追加
- クライアントは `X-API-Key` ヘッダに付与

## 関連

- [cli.md](./cli.md) — 同じ操作を shell から
- [mcp.md](./mcp.md) — AI クライアントから
- [quirks.md](./quirks.md) — CMS 側の制約 (draft/publish、select 値検証 等)
