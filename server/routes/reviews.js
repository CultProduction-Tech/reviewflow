const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = Router();
router.use(authMiddleware);

// Submit review decision
router.post('/reviews/:reviewId/decide', (req, res) => {
  const { decision } = req.body; // 'approved' or 'changes_requested'
  if (!['approved', 'changes_requested'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be approved or changes_requested' });
  }

  const db = getDb();
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found' });

  // Record decision
  db.prepare('INSERT INTO review_decisions (id, review_id, user_id, decision) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), review.id, req.user.id, decision);

  // Update review status
  db.prepare('UPDATE reviews SET status = ?, completed_at = datetime("now") WHERE id = ?')
    .run(decision, review.id);

  // Log activity
  const fv = db.prepare(`
    SELECT fv.*, f.name as file_name, f.project_id
    FROM file_versions fv
    JOIN files f ON fv.file_id = f.id
    WHERE fv.id = ?
  `).get(review.file_version_id);

  if (fv) {
    db.prepare('INSERT INTO activity_log (id, project_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), fv.project_id, req.user.id, 'review_decision',
        JSON.stringify({ file: fv.file_name, decision, version: fv.version_number }));
  }

  const updated = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.reviewId);
  res.json({ review: updated });
});

// Start review
router.post('/reviews/:reviewId/start', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE reviews SET status = "in_review", started_at = datetime("now") WHERE id = ? AND status = "pending"')
    .run(req.params.reviewId);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.reviewId);
  res.json({ review });
});

// Reset review (for new round)
router.post('/reviews/:reviewId/reset', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE reviews SET status = "pending", started_at = NULL, completed_at = NULL WHERE id = ?')
    .run(req.params.reviewId);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.reviewId);
  res.json({ review });
});

// Set due date
router.put('/reviews/:reviewId/due-date', (req, res) => {
  const { due_date } = req.body;
  const db = getDb();
  db.prepare('UPDATE reviews SET due_date = ? WHERE id = ?').run(due_date, req.params.reviewId);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.reviewId);
  res.json({ review });
});

// Get review details with decisions
router.get('/reviews/:reviewId', (req, res) => {
  const db = getDb();
  const review = db.prepare(`
    SELECT r.*, rg.name as group_name
    FROM reviews r
    JOIN reviewer_groups rg ON r.reviewer_group_id = rg.id
    WHERE r.id = ?
  `).get(req.params.reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found' });

  review.decisions = db.prepare(`
    SELECT rd.*, u.name as user_name, u.avatar_color
    FROM review_decisions rd
    LEFT JOIN users u ON rd.user_id = u.id
    WHERE rd.review_id = ?
    ORDER BY rd.created_at DESC
  `).all(review.id);

  res.json({ review });
});

// Get items awaiting my review
router.get('/my-reviews', (req, res) => {
  const db = getDb();
  const reviews = db.prepare(`
    SELECT r.*, rg.name as group_name, fv.version_number,
      f.name as file_name, f.id as file_id, p.name as project_name, p.id as project_id,
      fv.file_type, fv.thumbnail_path
    FROM reviews r
    JOIN reviewer_groups rg ON r.reviewer_group_id = rg.id
    JOIN file_versions fv ON r.file_version_id = fv.id
    JOIN files f ON fv.file_id = f.id
    JOIN projects p ON f.project_id = p.id
    JOIN reviewer_group_members rgm ON rgm.group_id = rg.id
    WHERE (rgm.user_id = ? OR rgm.email = (SELECT email FROM users WHERE id = ?))
      AND r.status IN ('pending', 'in_review')
    ORDER BY r.due_date ASC NULLS LAST, r.created_at DESC
  `).all(req.user.id, req.user.id);
  res.json({ reviews });
});

module.exports = router;
