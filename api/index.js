const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

// Override DB path for serverless (use /tmp)
process.env.DB_PATH = '/tmp/data.db';
process.env.UPLOAD_DIR = '/tmp/uploads';

const { waitForDb } = require('../server/database');
const { setupAuthRoutes } = require('../server/auth');
const projectsRouter = require('../server/routes/projects');
const filesRouter = require('../server/routes/files');
const reviewsRouter = require('../server/routes/reviews');
const commentsRouter = require('../server/routes/comments');
const activityRouter = require('../server/routes/activity');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Auth routes
setupAuthRoutes(app);

// API routes
app.use('/api/projects', projectsRouter);
app.use('/api', filesRouter);
app.use('/api', reviewsRouter);
app.use('/api', commentsRouter);
app.use('/api', activityRouter);

// Serve static uploads from /tmp
app.use('/api/uploads', express.static('/tmp/uploads'));

// Wait for DB before handling requests
let dbReady = false;
const dbPromise = waitForDb().then(() => { dbReady = true; });

module.exports = async (req, res) => {
  if (!dbReady) await dbPromise;
  app(req, res);
};
