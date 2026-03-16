const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { waitForDb } = require('./database');
const { setupAuthRoutes } = require('./auth');
const projectsRouter = require('./routes/projects');
const filesRouter = require('./routes/files');
const reviewsRouter = require('./routes/reviews');
const commentsRouter = require('./routes/comments');
const activityRouter = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true
}));
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

// Serve static uploads
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// Wait for DB to initialize, then start server
waitForDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
