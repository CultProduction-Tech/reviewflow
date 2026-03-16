const { Router } = require('express');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = Router();
router.use(authMiddleware);

// Get activity feed
router.get('/activity', (req, res) => {
  const { project_id, limit = 50 } = req.query;
  const db = getDb();

  let query = `
    SELECT a.*, u.name as user_name, u.avatar_color, p.name as project_name
    FROM activity_log a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN projects p ON a.project_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (project_id) {
    query += ' AND a.project_id = ?';
    params.push(project_id);
  } else {
    query += ` AND (a.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = ?
    ) OR a.user_id = ?)`;
    params.push(req.user.id, req.user.id);
  }

  query += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const activities = db.prepare(query).all(...params);
  res.json({ activities });
});

// Get notifications
router.get('/notifications', (req, res) => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
  res.json({ notifications, unread_count: unread.count });
});

// Mark notification as read
router.put('/notifications/:id/read', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Mark all as read
router.put('/notifications/read-all', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// Insights/Analytics
router.get('/insights', (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  const activeProjects = db.prepare(`
    SELECT COUNT(*) as count FROM projects
    WHERE status = 'active' AND (owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?))
  `).get(userId, userId);

  const totalVersions = db.prepare(`
    SELECT COUNT(*) as count FROM file_versions fv
    JOIN files f ON fv.file_id = f.id
    JOIN projects p ON f.project_id = p.id
    WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
  `).get(userId, userId);

  const totalReviews = db.prepare(`
    SELECT COUNT(*) as count FROM reviews r
    JOIN file_versions fv ON r.file_version_id = fv.id
    JOIN files f ON fv.file_id = f.id
    JOIN projects p ON f.project_id = p.id
    WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
  `).get(userId, userId);

  const approvedReviews = db.prepare(`
    SELECT COUNT(*) as count FROM reviews r
    JOIN file_versions fv ON r.file_version_id = fv.id
    JOIN files f ON fv.file_id = f.id
    JOIN projects p ON f.project_id = p.id
    WHERE r.status = 'approved' AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
  `).get(userId, userId);

  const avgComments = db.prepare(`
    SELECT COALESCE(AVG(c), 0) as avg FROM (
      SELECT COUNT(*) as c FROM comments
      WHERE file_version_id IN (
        SELECT fv.id FROM file_versions fv
        JOIN files f ON fv.file_id = f.id
        JOIN projects p ON f.project_id = p.id
        WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
      )
      GROUP BY file_version_id
    )
  `).get(userId, userId);

  const recentActivity = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM activity_log
    WHERE (project_id IN (SELECT project_id FROM project_members WHERE user_id = ?) OR user_id = ?)
      AND created_at >= date('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all(userId, userId);

  res.json({
    insights: {
      active_projects: activeProjects.count,
      total_versions: totalVersions.count,
      total_reviews: totalReviews.count,
      approved_reviews: approvedReviews.count,
      avg_comments_per_review: Math.round(avgComments.avg * 10) / 10,
      recent_activity: recentActivity
    }
  });
});

// Search across projects, files, comments
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });

  const db = getDb();
  const term = `%${q}%`;
  const userId = req.user.id;

  const projects = db.prepare(`
    SELECT 'project' as type, id, name, description as detail FROM projects
    WHERE (name LIKE ? OR description LIKE ?)
      AND (owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?))
    LIMIT 10
  `).all(term, term, userId, userId);

  const files = db.prepare(`
    SELECT 'file' as type, f.id, f.name, p.name as detail, f.project_id
    FROM files f JOIN projects p ON f.project_id = p.id
    WHERE f.name LIKE ?
      AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
    LIMIT 10
  `).all(term, userId, userId);

  const comments = db.prepare(`
    SELECT 'comment' as type, c.id, c.content as name, f.name as detail, c.file_version_id,
      f.id as file_id, f.project_id
    FROM comments c
    JOIN file_versions fv ON c.file_version_id = fv.id
    JOIN files f ON fv.file_id = f.id
    JOIN projects p ON f.project_id = p.id
    WHERE c.content LIKE ?
      AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
    LIMIT 10
  `).all(term, userId, userId);

  res.json({ results: [...projects, ...files, ...comments] });
});

// Folders
router.get('/folders', (req, res) => {
  const db = getDb();
  const folders = db.prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY name').all(req.user.id);
  res.json({ folders });
});

router.post('/folders', (req, res) => {
  const { name, parent_id } = req.body;
  const db = getDb();
  const id = require('uuid').v4();
  db.prepare('INSERT INTO folders (id, name, user_id, parent_id) VALUES (?, ?, ?, ?)')
    .run(id, name || 'New Folder', req.user.id, parent_id || null);
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
  res.status(201).json({ folder });
});

router.delete('/folders/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
