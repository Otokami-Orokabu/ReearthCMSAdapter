# Re:Earth CMS の既知クセ (運用メモ)

実装中に判明した Re:Earth CMS 固有の仕様・制約。**ACL 層 (`@hw/reearth-api-server`) がこれらを踏まえて設計されている**ため、拡張時や運用時の参考に。

## 1. Model ID は schema URL の末尾 UUID

Re:Earth CMS 管理画面でモデル編集ページを開いた URL:
```
https://cms.reearth.io/workspace/<ws>/project/<p>/schema/01kpsehqqp5773xwznd1k9c3f6
                                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                        これが Model ID
```

Integration API は ID (UUID) / model key のどちらも受け付ける。CLI の `reearth-cms models` でも一覧取得可能。

## 2. Integration API は draft 作成、Public API は published のみ表示

`createItem` / `updateItem` で作成・更新した item は **draft** 状態で作られる。
- Public API (`listItems`) には**表示されない**
- Integration API で個別取得は可能

公開するには `POST /api/{ws}/projects/{p}/models/{m}/items/{id}/publish` を叩く必要がある (本プロジェクトでは `publishItem` Core メソッド / `publish` CLI / `publish_item` MCP tool 経由)。

```bash
# seed で 100 件注入しても...
reearth-cms seed hazzrd_reports --count 100

# list は増えない (draft のまま)
reearth-cms list hazzrd_reports
# → 既存の published items だけ表示

# publish すると初めて出てくる
reearth-cms publish hazzrd_reports <id>
```

「seed したのに list に出ない」という混乱は、これが原因。

## 3. `select` / `tag` フィールドは CMS 定義の選択肢と完全一致必須

Field type が `select` / `tag` の場合、`value` 文字列は **CMS モデル側で登録済みの選択肢と完全一致**する必要がある。不一致なら **HTTP 400 Bad Request**。

```bash
# hazzrd_reports.category の選択肢が "disaster", "other" だけなら...

# OK
reearth-cms seed hazzrd_reports --category "disaster,other"

# NG (obstruction が未登録)
reearth-cms seed hazzrd_reports --category "disaster,obstruction,other"
# → 約 1/3 の確率で HTTP 400
```

**対策**: 実際の選択肢を事前に確認 (CMS UI から) するか、不明なら select/tag field 自体を省略する。

## 4. Public API の URL は 3 セグメント (SDK と食い違う)

公式 SDK (`@reearth/cms-api/public` v0.2.0) は `/api/p/{project}/{model}` (2 segments) 前提だが、現行 SaaS (`api.cms.reearth.io`) の実 API は:

```
/api/p/{workspace}/{project}/{model}    ← 3 segments
```

SDK を使うと 404 になる。本プロジェクトの `packages/reearth-api-server/src/public.ts` は SDK を捨てて **自前 fetch で 3 セグメント URL を組み立てている**。

Public API で新エンドポイントを追加する場合は、この `public.ts` の fetch パターンを踏襲すること (SDK を呼ばない)。

## 5. workspace / project / model は ID / alias / key どれでも受け付ける

SDK / サーバ API ともに workspace・project・model は以下を受け付ける:

| 種類 | 形式 | 例 |
|---|---|---|
| UUID (ID) | `01kpq...` | `01kpq695k8nvmjz61wayhe2m2p` |
| Alias / key | 人間可読文字列 | `oromapstudy`, `hazzrd_reports` |

`.env` の `CMS_WORKSPACE` / `CMS_PROJECT` / `CMS_MODEL` はどちらの形式でも可。運用的には:
- **workspace / project**: UI URL から UUID を抜けるので楽
- **model**: `key` の方が読みやすい、`reearth-cms models` で両方確認可能

## 6. Public API の `.geojson` variant で GeoJSON FeatureCollection が取れる

URL の末尾に `.geojson` を付けると、FeatureCollection 形式で返る:

```
# 通常 (flat JSON)
/api/p/{workspace}/{project}/{model}
→ { "results": [{id, title, location, ...}, ...] }

# .geojson variant
/api/p/{workspace}/{project}/{model}.geojson
→ { "type": "FeatureCollection", "features": [{geometry, properties, ...}] }
```

差分:
- location を持たない item は **CMS 側で除外**される (location-less な item は feature にならない)
- `location` フィールドは `geometry` にリネーム
- その他のフィールドは `properties` に詰め込まれる
- item の `id` は feature top-level の `id` に昇格

本プロジェクトの `listFeatures` Core 関数 / `reearth-cms features` CLI / MCP `list_features` tool / HTTP `/api/features/:model` ルートはこの variant を内部で叩いている。MapLibre / Leaflet / Mapbox に直接データソースとして渡せる形。

## 7. Integration API の 2 種類の schema 形式 — 情報量が大きく違う

同じモデルについて、**2 つのエンドポイント**で形式が異なる schema が返る:

### 軽量版: `GET /api/{ws}/projects/{p}/models/{model}`

SDK の `getModel()` が叩く方。`schema.fields[]` に以下のみ:
```
{ id, key, name, type, required, multiple }
```

select / tag の選択肢、geometry の許容型、field 説明 などは**含まれない**。

### リッチ版: `GET /api/{ws}/projects/{p}/models/{model}/schema.json` ← 推奨

**JSON Schema 2020-12** 形式 + `x-` 拡張。実測した追加情報:

| 追加情報 | JSON Schema キー | 例 |
|---|---|---|
| field 説明 | `description` | `"危険の種類"` |
| select / tag 選択肢 | `x-options` | `["road", "facility", "disaster", "other"]` |
| geometry 許容型 | `x-geoSupportedTypes` / `x-geoSupportedType` | `["POINT"]` / `"LINESTRING"` |
| multiple フラグ | `x-multiple` | `true` / `false` |
| CMS 型名 | `x-fieldType` | `"select"` / `"geometryObject"` 等 |

例: `hazzrd_reports.category` の selects は `["road", "facility", "disaster", "other"]`。軽量版では決して得られないが、`schema.json` variant なら取れる。

**本プロジェクトは `getModel` を**この両方をマージして返す実装**にしている**ので、Core 利用側 (CLI/MCP/HTTP) は追加の field を通常通り参照するだけで良い (`CmsFieldSchema.options` / `.description` / `.geoSupportedTypes`)。

### 未検証の field 型

手元の CMS モデルに以下が存在しないため未確認:
- `reference` → おそらく `$ref` か `x-modelId` 的な形で参照先が入る
- `group` → JSON Schema 標準の `type: "object"` + ネスト `properties` になる想定
- `tag` → `type: "array"` + `x-options` になる想定

該当 field が出た時点で `getJsonSchema` raw で確認し、必要なら Core の型に反映する。

### metadata_schema.json は要注意

`/metadata_schema.json` は metadata schema が定義されていないモデルでは **500 internal server error** を返す (本プロジェクトの hazzrd_reports で実測)。呼び出しは try/catch で落ちる前提。

## 8. `CmsFieldType` enum に入っていない CMS の field 型がある

本 ACL が列挙している `CmsFieldType` に含まれない型が SDK の `valueType` には存在する:

| SDK の valueType | 本 ACL での扱い |
|---|---|
| `checkbox` | 未対応 |
| `group` (複数フィールドを集約する構造) | 未対応 |
| `geometryEditor` (Point 以外の GeoJSON: LineString / Polygon) | 未対応 |

`getModel` の schema を読むと、これらの型の field は `type: string` として露出する (本ACL は schema 側を緩い string にしているため OK)。ただし `create_item` / `update_item` のランタイムバリデータ `isCmsPayload` が CmsFieldType を enum として要求するため、**書き込み時にはバリデータが通らず 400 相当**。

これらを書き込みたい場合は:
- `CMS_FIELD_TYPE_VALUES` に追加して ACL を拡張
- `toCmsFields` / バリデータを対応した型へ広げる

**実例**: `hazzrd_reports.oos` が `geometryEditor` 型 (LineString 等の描画用)。Point のみ想定の現行 `makePointGeometry` ヘルパでは作れない。

## 9. Integration API の新方式 URL は `/api/{workspace}/projects/{project}/models/{model}/items`

`workspaces/` のような prefix は**無い** (古い OpenAPI スキーマにある `/workspaces/` は実 API で使われない)。

```
OK:  /api/{ws}/projects/{p}/models/{m}/items/{id}
NG:  /api/workspaces/{ws}/projects/{p}/models/{m}/items/{id}  ← 404
```

SDK は前者を使う。kobe-map-server も前者。

## 10. Public API `listItems` のページング方針

Public API は `{ results, totalCount, page, perPage }` のエンベロープを返す。本 ACL (`packages/reearth-api-server/src/public.ts::listItemsPublic`) は:

- `per_page=100` で `page=1` から順次取得
- `results.length < 100` もしくは `totalCount` に達した時点で終了
- 安全弁として最大 100 ページ (= 10,000 items) でハード打ち切り

全ページ fetch 後に `applyListOps` で bbox/near/sort/offset/limit を**すべてクライアント側で適用**する。理由:
- bbox/near は Public API にクエリとして乗せる手段がない
- sort はサーバ側挙動が不安定
- `offset` を含む slice は filter/sort 後でなければ正しい順序にならない

**将来の最適化 TODO**: CMS 側が bbox/near/sort を受け入れるクエリを提供したら、その分のクライアント側処理を skip して「必要なページだけ取る」方向に寄せられる。

## 11. Public API `.geojson` variant のページング挙動

`listFeaturesPublic` (`{model}.geojson`) も同様にページング対応済み。ただし flat JSON との違いに注意:

| 項目 | flat JSON | `.geojson` variant |
|---|---|---|
| レスポンス envelope | `{ results, totalCount, ... }` | `{ type: 'FeatureCollection', features }` |
| `totalCount` | あり | **なし** |
| 短ページ (`length < per_page`) | ほぼ起きない | **起きる**（Point を持たない item がサーバ側で除外されるため） |
| 空ページ (`length === 0`) | 末尾 | 末尾 |

このため `listFeaturesPublic` の終端判定は **「空ページを受信したら break」** としている（短ページ break は不可 — 途中の page で Point 不足による 2 件返りが発生するので、切り上げると取りこぼす）。

実測例 (`hazzrd_reports` で items=9, Point を持つもの=7):
- `per_page=3&page=1` → 2 features (3 items のうち 2 件が Point)
- `per_page=3&page=2` → 3 features
- `per_page=3&page=3` → 2 features
- `per_page=3&page=4` → 0 features （終端）

MAX_PAGES × PAGE_SIZE = 10,000 を超えた場合は `ReearthApiError` を throw（`listItemsPublic` と対称）。

## 12. `asset.public` と `asset.url` のセマンティクス

`CmsAsset` は `public: boolean` と `url: string` を含む。実機観察 (`assets.cms.reearth.io`):

| `public` | `url` の挙動 |
|---|---|
| `true` | **匿名アクセス可**。`access-control-allow-origin: *` + `cache-control: public, max-age=3600` が付く。そのままブラウザの `<img src>` / `<a href>` で使える。CDN 配信 (CMS 本体ドメインとは別) |
| `false` | 未検証 (本プロジェクトの全 asset が public のため)。CMS 仕様上は非公開を意味するので、**ブラウザから直接参照できる保証はない**。web クライアントで使う前に `asset.public === true` を確認するのが安全 |

ブラウザクライアントから asset を参照するときの推奨フロー:

```ts
const asset = await fetch('/api/assets/<id>').then(r => r.json());
if (!asset.public) {
  // fallback: show placeholder, or proxy through the backend
  return;
}
imgEl.src = asset.url;
```

サーバ側 (HTTP adapter / Core) は `public` の値を加工せず透過的に返す。public-visibility の判断は**呼び出し側の責務**。
