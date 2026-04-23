# Meisho Explorer (@hw/web)

日本の名所を地図と特集で巡るオフライン対応 PWA。

## 特徴

- **地図** (MapLibre + GSI タイル) にカテゴリ別ピン
- **都道府県 / カテゴリ / キーワード / 行った** の 4 軸絞り込み
- **行った** フラグをローカルで即反映、オンラインなら CMS へ送信、オフラインなら送信キューに保留
- **特集** (stories モデル) を markdown 本文 + 名所の inline preview カード付きでレンダリング
- **オフライン**: 初回起動はバンドル同梱の 107 件スナップショットから読む。SW が app shell / API / 画像 / 地図タイルを runtime cache

## データフロー

```
[bundled-landmarks.json (アプリ内)]
        │  seed (初回 or 空のとき)
        ▼
[IndexedDB: landmarks / stories]  ◀─── Network First (syncLandmarks, syncStories)
        │                                       │
        │ read                                  │ on online: flushPending()
        ▼                                       │
[UI state]                                      │
        │ ユーザー操作 (行った トグル)           │
        ▼                                       │
[patchLandmark]                                 │
        ├─ IDB に即時書き込み (楽観更新)         │
        └─ PATCH /api/items/:id                 │
              ├─ 成功 → sent                    │
              └─ 失敗 → IDB pendingUpdates     ─┘
```

## PWA 設定

- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) の GenerateSW モード
- app shell: precache (workbox default)
- `/api/*`: NetworkFirst (3 秒タイムアウト → cache)
- `assets.cms.reearth.io`: CacheFirst (30 日)
- `cyberjapandata.gsi.go.jp` (GSI 地図タイル): CacheFirst (30 日)
- アイコン (`/icon-192.png`, `/icon-512.png`, `/icon-512-maskable.png`) は `public/` に配置が必要 (未配置)

## 必要な CMS 設定 (ユーザー作業)

### `visited` field を CMS の `landmarks` モデルに追加

「行った」トグルを CMS に反映させるには、`landmarks` モデルに以下のフィールドを UI で追加してください:

| 項目 | 値 |
|---|---|
| key | `visited` |
| 表示名 | `行った` |
| type | `bool` |
| required | いいえ (false) |
| multiple | いいえ |
| unique | いいえ |

追加しない場合でも UI は動作します (行ったトグルは IndexedDB に残り、送信キューにも積まれるが、CMS 側に field がないため PATCH が 400 になる)。

### `stories` (特集) サンプル投入

特集ページを見るにはサンプルの stories アイテムを投入してください。CLI で 1 件例:

```bash
cat > /tmp/story1.json <<'EOF'
{
  "title": { "type": "text", "value": "現存天守 12 城を巡る旅" },
  "lead":  { "type": "textArea", "value": "江戸時代までに建造され現存する天守を巡ります" },
  "body":  { "type": "markdown", "value": "江戸時代以前の姿を残す **現存天守** は全国に 12。\n\n[弘前城](/landmark/<弘前城の id>) は桜の名所。\n[松本城](/landmark/<松本城の id>) は黒漆の現存天守。\n[姫路城](/landmark/<姫路城の id>) は世界遺産。" }
}
EOF
rcms create stories --file /tmp/story1.json
rcms publish stories <returned-id>
```

`<... の id>` は `rcms list landmarks --all` の出力から控えてください。

## 開発

```bash
# 開発サーバ (Express :3000 + Vite :5173)
npm run dev

# ビルド (PWA 生成込み)
npm run -w @hw/web build

# プレビュー (生成された PWA を :4173 で配信)
npm run -w @hw/web preview
```

## ルート

| path | 内容 |
|---|---|
| `/` | 地図 + 一覧 + 絞り込み |
| `/landmark/:id` | 名所詳細 + 行ったトグル |
| `/visited` | 行った名所の都道府県別リスト |
| `/stories` | 特集一覧 |
| `/story/:id` | 特集詳細 (markdown + inline landmark preview) |
