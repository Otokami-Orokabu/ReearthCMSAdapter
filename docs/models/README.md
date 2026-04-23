# モデル定義ファイル

日本名所サンプルアプリ (Meisho Explorer) 用の Re:Earth CMS モデル仕様書。形式は CMS の **モデルインポート用 JSON Schema 2020-12 + `x-*` 拡張** に揃えている (ベース: `import-schema-template.json`)。

## ファイル

- [`landmarks-schema.json`](landmarks-schema.json) — 名所 1 件を表すモデル (全 7 フィールド)
- [`stories-schema.json`](stories-schema.json) — 特集記事モデル (インポート可能な 4 フィールド)
- [`import-schema-template.json`](../../docs/models/import-schema-template.json) — 全型サンプル (実機生成)

## インポートテンプレの規約

`import-schema-template.json` から確定した書き方:

| 書き方 | 意味 |
|---|---|
| `type` を書かない | `x-fieldType` で型が決まる (以前書いていた `type: "string"` は不要) |
| `x-fieldType` | 必須。`text`, `textArea`, `markdown`, `bool`, `datetime`, `number`, `integer`, `select`, `asset`, `url`, `geometryObject`, `geometryEditor` |
| `x-required` | 必須項目か (bool) |
| `x-multiple` | 配列値を許すか (bool)。`true` の時は `x-defaultValue` が配列 |
| `x-unique` | 一意制約 (bool) |
| `x-defaultValue` | 既定値 (任意) |
| `maxLength` | 文字列型で使う (text / textArea / markdown) |
| `maximum` / `minimum` | 数値型で使う (integer / number) |
| `format: "date-time"` | `datetime` フィールドに併記 |
| `x-options` | select の選択肢 (文字列配列) |
| `x-geoSupportedTypes` | `geometryObject` で許容する GeoJSON 型 (配列) |
| `x-geoSupportedType` | `geometryEditor` で許容する型 (単数、文字列) |

## テンプレに含まれない型 (手動対応)

以下はインポートテンプレのサンプルに載っていない。CMS UI で手動作成してから `rcms schema <model>` で dump して確認する必要あり:

- **`tag`** — `select` multi で代替するか、CMS で試験作成
- **`reference`** — 別モデルへの参照 (UUID 値)
- **`group`** — 入れ子サブフィールド
- **`richText`** — リッチテキスト

## 投入手順

1. CMS UI のモデルインポート機能で `landmarks-schema.json` を読み込む (要検証: UI にインポート機能があるか)
2. インポートできない場合は、CMS UI でモデルを手動作成し、この JSON を見ながらフィールドを 1 つずつ設定
3. `rcms models --json` で `landmarks` モデル UUID を控える
4. `stories-schema.json` も同様にインポート。`$id` は空のまま CMS が採番
5. 実際の schema を `rcms schema landmarks` / `rcms schema stories` で取得し、この JSON と照合

## モデル UUID

実機で作成済み (2026-04 時点):

| モデル key | model id (`rcms models`) | schema `$id` (`rcms schema`) |
|---|---|---|
| `landmarks` | `01kpx4sfj2vk1c6q1eyvx0pmeq` | `01kpx4sfhzytk54vpb8rqbnav5` |
| `stories` | `01kpx52fafya1t95ra6x50hm8w` | `01kpx52facpr227ss4yy3vejb2` |

アプリ側は model key (`landmarks` / `stories`) で参照するため UUID を直接書く必要は通常ない。

## 将来の拡張候補

最小構成から追加しやすいフィールド:

- `landmarks.tags` (`tag`): 世界遺産 / 国宝 / 紅葉 / 桜 などテーマ語
- `landmarks.best_season` (`tag` multi): 春 / 夏 / 秋 / 冬
- `landmarks.nearby_landmarks` (`reference` multi): 徒歩圏の他名所
- `landmarks.admission_fee_yen` (`integer`): 入場料
- `landmarks.website` (`url`): 公式サイト
- `landmarks.heritage_status` (`select`): 世界遺産 / 国宝 / 重要文化財 / 国史跡
- `stories.featured_landmarks` (`reference` multi): 掲載名所を構造化したい場合 (UI で手動追加。`group` はインポート非対応)

CMS のフィールド追加は既存アイテムを壊さないため、最小から始めて必要に応じて育てられる。
