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

## 7. `select` / `tag` フィールドの選択肢は schema API からは取れない

`getModel` で取得できる field schema は `{id, key, name, type, required, multiple}` のみで、**`select` / `tag` の選択肢 (options) は含まれない**。

→ 有効値を知るには:
- CMS 管理 UI から確認
- 既存 item の値分布を `listItems` で取得して参考にする (例: `hazzrd_reports.category` は `disaster` / `other` しか観測されていない)

これが原因で `seed --category "obstruction,..."` が 400 で弾かれる事例が発生する (本プロジェクトでも実測済)。

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
