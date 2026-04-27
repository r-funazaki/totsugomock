/**
 * 払込取扱票 突合システム — Node.js (Express) モックサーバー
 *
 * 構成:
 *   - /            : 静的配信 (public/index.html)
 *   - /api/health  : ヘルスチェック
 *   - /api/upload  : ファイルアップロード受け口 (スタブ)
 *   - /api/match   : 突合処理 API (スタブ — 実処理はクライアント側)
 *   - /api/log     : クライアントからの操作ログ受け口 (スタブ)
 *
 * 注: 現時点ではクライアント側 (PDF.js / pdf-lib / PapaParse) で
 *     PDF・CSV 解析と突合を完結させるため、サーバー API はスタブ実装。
 *     将来サーバー側で解析する際は /api/upload と /api/match を実装する。
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- ミドルウェア ----------
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// アップロード保存先
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^\w.\-ぁ-んァ-ヶー一-龠]/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// ---------- アクセスログ ----------
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

// ---------- ルート ----------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'totsugou-mock',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ファイルアップロード (スタブ)
// クライアント側でファイル解析するため、必要に応じてバックアップ的に受信する想定
app.post('/api/upload', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'csv', maxCount: 1 },
]), (req, res) => {
  try {
    const result = {
      received: {},
      uploadedAt: new Date().toISOString(),
    };
    if (req.files?.pdf?.[0]) {
      result.received.pdf = {
        originalname: req.files.pdf[0].originalname,
        size: req.files.pdf[0].size,
        savedAs: req.files.pdf[0].filename,
      };
    }
    if (req.files?.csv?.[0]) {
      result.received.csv = {
        originalname: req.files.csv[0].originalname,
        size: req.files.csv[0].size,
        savedAs: req.files.csv[0].filename,
      };
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 突合処理 API (スタブ)
// クライアントが抽出したPDF情報・CSV情報を受け取り、突合結果を返す想定
// 現状はクライアントで突合まで完結するため、エコー実装にとどめる
app.post('/api/match', (req, res) => {
  try {
    const { pdfPages = [], csvRows = [] } = req.body || {};

    // サーバー側突合のスタブ実装 (一連番号 + 取扱店の完全一致)
    const usedCsv = new Set();
    const results = [];

    pdfPages
      .filter(p => p.isSlip || p.isFurikae)
      .forEach(pg => {
        const csvIdx = csvRows.findIndex(
          (r, i) => !usedCsv.has(i) && r.slipNumber === pg.slipNumber,
        );
        if (csvIdx >= 0) {
          usedCsv.add(csvIdx);
          const csv = csvRows[csvIdx];
          const branchOk = csv.branch === pg.branch;
          const slipOk = csv.slipNumber === pg.slipNumber;
          results.push({
            type: 'matched',
            status: branchOk && slipOk ? 'OK' : 'NG',
            pdfPage: pg.pageIndex,
            pdfSlip: pg.slipNumber,
            pdfBranch: pg.branch,
            csvSlip: csv.slipNumber,
            csvBranch: csv.branch,
            slipMatch: slipOk,
            branchMatch: branchOk,
          });
        } else {
          results.push({
            type: 'pdf_only',
            status: 'NG',
            pdfPage: pg.pageIndex,
            pdfSlip: pg.slipNumber,
            pdfBranch: pg.branch,
            csvSlip: '',
            csvBranch: '',
            slipMatch: false,
            branchMatch: false,
          });
        }
      });

    csvRows.forEach((r, i) => {
      if (!usedCsv.has(i)) {
        results.push({
          type: 'csv_only',
          status: 'NG',
          pdfPage: null,
          pdfSlip: '',
          pdfBranch: '',
          csvSlip: r.slipNumber,
          csvBranch: r.branch,
          slipMatch: false,
          branchMatch: false,
        });
      }
    });

    const summary = {
      pdfCount: pdfPages.filter(p => p.isSlip || p.isFurikae).length,
      csvCount: csvRows.length,
      okCount: results.filter(r => r.status === 'OK').length,
      ngCount: results.filter(r => r.status === 'NG').length,
    };

    res.json({ ok: true, results, summary, processedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Match error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 操作ログ受信 (スタブ)
app.post('/api/log', (req, res) => {
  console.log('[client log]', JSON.stringify(req.body));
  res.json({ ok: true });
});

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found', path: req.url });
});

// エラーハンドラ
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ ok: false, error: err.message });
});

// ---------- 起動 ----------
app.listen(PORT, () => {
  console.log('================================================');
  console.log('  払込取扱票 突合システム — Mock Server');
  console.log('================================================');
  console.log(`  URL    : http://localhost:${PORT}`);
  console.log(`  Health : http://localhost:${PORT}/api/health`);
  console.log(`  Upload : http://localhost:${PORT}/uploads/`);
  console.log('================================================');
  console.log('  Ctrl+C で停止');
});
