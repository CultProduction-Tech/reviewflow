const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

// Setup paths for serverless
const TMP_DB = '/tmp/data.db';
const TMP_UPLOADS = '/tmp/uploads';
process.env.DB_PATH = TMP_DB;
process.env.UPLOAD_DIR = TMP_UPLOADS;

// Ensure dirs exist
if (!fs.existsSync(TMP_UPLOADS)) fs.mkdirSync(TMP_UPLOADS, { recursive: true });

// Copy sql-wasm.wasm to /tmp if needed for sql.js
const wasmSrc = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmDst = '/tmp/sql-wasm.wasm';
if (fs.existsSync(wasmSrc) && !fs.existsSync(wasmDst)) {
  fs.copyFileSync(wasmSrc, wasmDst);
}

// Override sql.js init to use the correct wasm path
const originalInitSqlJs = require('sql.js');
const initSqlJsPatched = (config) => {
  return originalInitSqlJs({
    ...config,
    locateFile: file => {
      if (fs.existsSync(wasmDst)) return wasmDst;
      return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file);
    }
  });
};

// Monkey-patch the database module
const dbModule = require('../server/database');

const { setupAuthRoutes } = require('../server/auth');
const projectsRouter = require('../server/routes/projects');
const filesRouter = require('../server/routes/files');
const reviewsRouter = require('../server/routes/reviews');
const commentsRouter = require('../server/routes/comments');
const activityRouter = require('../server/routes/activity');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

setupAuthRoutes(app);

app.use('/api/projects', projectsRouter);
app.use('/api', filesRouter);
app.use('/api', reviewsRouter);
app.use('/api', commentsRouter);
app.use('/api', activityRouter);

app.use('/api/uploads', express.static(TMP_UPLOADS));

let dbReady = false;
const dbPromise = dbModule.waitForDb().then(() => { dbReady = true; }).catch(err => {
  console.error('DB init error:', err);
});

module.exports = async (req, res) => {
  if (!dbReady) await dbPromise;
  app(req, res);
};
