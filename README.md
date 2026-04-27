# 払込取扱票 突合システム — Node.js モック

PDF (払込取扱票) と CSV (入金明細) を突合する Web アプリの Node.js 版モックです。

## 構成

```
totsugou-mock/
├── package.json        ... 依存定義 (express, multer)
├── server.js           ... Express サーバー
├── public/
│   └── index.html      ... フロントエンド (元モックのUI/ロジックそのまま)
└── uploads/            ... アップロードファイル保存先 (自動生成)
```

## セットアップ

Node.js 18 以上が必要です。

```bash
cd totsugou-mock
npm install
npm start
```

起動後、ブラウザで以下にアクセス:

```
http://localhost:3000
```

開発時はファイル変更で自動再起動する `dev` も使えます:

```bash
npm run dev
```

## 動作

- フロントエンド (`public/index.html`) は元のシングルファイル版と同等で、
  PDF.js / pdf-lib / PapaParse / xlsx / encoding-japanese / jszip を CDN から読込み、
  クライアント側で PDF・CSV の解析と突合を行います。
- サーバー側 (`server.js`) は静的配信に加えて以下の API スタブを提供します。
  将来サーバー側で解析処理に切り替える際の足がかりになります。

## API エンドポイント

| メソッド | パス | 用途 |
|---|---|---|
| GET  | `/`            | フロントエンド配信 |
| GET  | `/api/health`  | ヘルスチェック (UI 右上に状態表示) |
| POST | `/api/upload`  | PDF/CSV ファイルアップロード受け口 (multipart) |
| POST | `/api/match`   | 突合処理 API (サーバー側突合のスタブ実装あり) |
| POST | `/api/log`     | クライアント操作ログ受信 |

### `/api/match` のサンプル

```bash
curl -X POST http://localhost:3000/api/match \
  -H "Content-Type: application/json" \
  -d '{
    "pdfPages": [
      { "pageIndex": 1, "isSlip": true, "slipNumber": "11300011", "branch": "新宿" }
    ],
    "csvRows": [
      { "slipNumber": "11300011", "branch": "新宿" }
    ]
  }'
```

レスポンス例:

```json
{
  "ok": true,
  "results": [
    {
      "type": "matched",
      "status": "OK",
      "pdfPage": 1,
      "pdfSlip": "11300011",
      "pdfBranch": "新宿",
      "csvSlip": "11300011",
      "csvBranch": "新宿",
      "slipMatch": true,
      "branchMatch": true
    }
  ],
  "summary": { "pdfCount": 1, "csvCount": 1, "okCount": 1, "ngCount": 0 }
}
```

## 注意事項

- 現状のフロントエンドはサーバー API を**呼び出していません** (静的モードでも完全に動作します)。
  サーバー連携はヘルスチェック表示と操作ログ送信のみ。
- 将来サーバー側で PDF 解析する場合は `server.js` の `/api/upload` と `/api/match` を実装してください。
- アップロードされたファイルは `uploads/` に保存されます。本番運用時は適宜クリーンアップ処理を追加してください。

## ライセンス

MIT
