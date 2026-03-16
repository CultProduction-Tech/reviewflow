const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = Router();
router.use(authMiddleware);

// Get comments for a file version
router.get('/versions/:versionId/comments', (req, res) => {
  const { reviewer_group_id } = req.query;
  const db = getDb();

  let query = `
    SELECT c.*, u.name as user_name, u.avatar_color,
      (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) as reply_count
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.file_version_id = ? AND c.parent_id IS NULL
  `;
  const params = [req.params.versionId];

  if (reviewer_group_id) {
    query += ' AND c.reviewer_group_id = ?';
    params.push(reviewer_group_id);
  }

  query += ' ORDER BY c.created_at ASC';
  const comments = db.prepare(query).all(...params);

  // Get replies
  for (const comment of comments) {
    comment.replies = db.prepare(`
      SELECT c.*, u.name as user_name, u.avatar_color
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.parent_id = ?
      ORDER BY c.created_at ASC
    `).all(comment.id);

    comment.annotations = db.prepare('SELECT * FROM annotations WHERE comment_id = ?').all(comment.id);
  }

  res.json({ comments });
});

// Add comment
router.post('/versions/:versionId/comments', (req, res) => {
  const { content, parent_id, reviewer_group_id, pos_x, pos_y, pos_width, pos_height, time_marker, page_number, annotations } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const db = getDb();
  const commentId = uuidv4();

  db.prepare(`INSERT INTO comments (id, file_version_id, reviewer_group_id, user_id, author_name, author_email, content, parent_id,
    pos_x, pos_y, pos_width, pos_height, time_marker, page_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(commentId, req.params.versionId, reviewer_group_id || null, req.user.id,
      req.user.name, req.user.email, content, parent_id || null,
      pos_x ?? null, pos_y ?? null, pos_width ?? null, pos_height ?? null,
      time_marker ?? null, page_number ?? null);

  // Save annotations
  if (annotations && annotations.length > 0) {
    const insertAnnotation = db.prepare('INSERT INTO annotations (id, comment_id, type, data) VALUES (?, ?, ?, ?)');
    for (const ann of annotations) {
      insertAnnotation.run(uuidv4(), commentId, ann.type, JSON.stringify(ann.data));
    }
  }

  // Log activity
  const fv = db.prepare(`
    SELECT f.project_id, f.name as file_name
    FROM file_versions fv JOIN files f ON fv.file_id = f.id WHERE fv.id = ?
  `).get(req.params.versionId);
  if (fv) {
    db.prepare('INSERT INTO activity_log (id, project_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), fv.project_id, req.user.id, 'comment_added',
        JSON.stringify({ file: fv.file_name, comment: content.substring(0, 100) }));
  }

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color
    FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).get(commentId);
  comment.replies = [];
  comment.annotations = annotations ? db.prepare('SELECT * FROM annotations WHERE comment_id = ?').all(commentId) : [];

  res.status(201).json({ comment });
});

// Update comment
router.put('/comments/:commentId', (req, res) => {
  const { content, is_resolved } = req.body;
  const db = getDb();

  if (content !== undefined) {
    db.prepare('UPDATE comments SET content = ?, updated_at = datetime("now") WHERE id = ? AND user_id = ?')
      .run(content, req.params.commentId, req.user.id);
  }
  if (is_resolved !== undefined) {
    db.prepare('UPDATE comments SET is_resolved = ? WHERE id = ?')
      .run(is_resolved ? 1 : 0, req.params.commentId);
  }

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color
    FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).get(req.params.commentId);
  res.json({ comment });
});

// Delete comment
router.delete('/comments/:commentId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM comments WHERE id = ? AND user_id = ?').run(req.params.commentId, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
