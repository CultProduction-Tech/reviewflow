const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = Router();
router.use(authMiddleware);

// List all projects for current user
router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*,
      u.name as owner_name,
      (SELECT COUNT(*) FROM files f WHERE f.project_id = p.id) as file_count,
      (SELECT COUNT(*) FROM reviewer_groups rg WHERE rg.project_id = p.id) as reviewer_group_count,
      (SELECT COUNT(*) FROM reviews r
        JOIN file_versions fv ON r.file_version_id = fv.id
        JOIN files f ON fv.file_id = f.id
        WHERE f.project_id = p.id AND r.status = 'approved') as approved_count,
      (SELECT COUNT(*) FROM reviews r
        JOIN file_versions fv ON r.file_version_id = fv.id
        JOIN files f ON fv.file_id = f.id
        WHERE f.project_id = p.id AND r.status = 'changes_requested') as changes_requested_count,
      (SELECT COUNT(*) FROM reviews r
        JOIN file_versions fv ON r.file_version_id = fv.id
        JOIN files f ON fv.file_id = f.id
        WHERE f.project_id = p.id AND r.status = 'pending') as pending_count
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.owner_id = ? OR p.id IN (
      SELECT project_id FROM project_members WHERE user_id = ?
    )
    ORDER BY p.updated_at DESC
  `).all(req.user.id, req.user.id);
  res.json({ projects });
});

// Create project
router.post('/', (req, res) => {
  const { name, description, folder_id, due_date, reviewer_groups } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const db = getDb();
  const projectId = uuidv4();

  db.prepare('INSERT INTO projects (id, name, description, folder_id, owner_id, due_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(projectId, name, description || null, folder_id || null, req.user.id, due_date || null);

  // Default section
  db.prepare('INSERT INTO sections (id, name, project_id, sort_order) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), 'All files', projectId, 0);

  // Add owner as member
  db.prepare('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), projectId, req.user.id, 'owner');

  // Create reviewer groups
  if (reviewer_groups && reviewer_groups.length > 0) {
    const insertGroup = db.prepare('INSERT INTO reviewer_groups (id, name, project_id, sort_order) VALUES (?, ?, ?, ?)');
    reviewer_groups.forEach((group, index) => {
      insertGroup.run(uuidv4(), group.name || `Reviewer Group ${index + 1}`, projectId, index);
    });
  } else {
    db.prepare('INSERT INTO reviewer_groups (id, name, project_id, sort_order) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), 'Reviewer Group 1', projectId, 0);
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  res.status(201).json({ project });
});

// Get single project with full details
router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare(`
    SELECT p.*, u.name as owner_name
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const sections = db.prepare('SELECT * FROM sections WHERE project_id = ? ORDER BY sort_order').all(project.id);
  const reviewerGroups = db.prepare('SELECT * FROM reviewer_groups WHERE project_id = ? ORDER BY sort_order').all(project.id);

  // Get reviewer group members
  for (const group of reviewerGroups) {
    group.members = db.prepare('SELECT * FROM reviewer_group_members WHERE group_id = ?').all(group.id);
  }

  const files = db.prepare(`
    SELECT f.*, u.name as uploader_name,
      (SELECT fv.id FROM file_versions fv WHERE fv.file_id = f.id ORDER BY fv.version_number DESC LIMIT 1) as latest_version_id,
      (SELECT fv.version_number FROM file_versions fv WHERE fv.file_id = f.id ORDER BY fv.version_number DESC LIMIT 1) as latest_version,
      (SELECT fv.file_type FROM file_versions fv WHERE fv.file_id = f.id ORDER BY fv.version_number DESC LIMIT 1) as file_type,
      (SELECT fv.thumbnail_path FROM file_versions fv WHERE fv.file_id = f.id ORDER BY fv.version_number DESC LIMIT 1) as thumbnail_path,
      (SELECT fv.file_size FROM file_versions fv WHERE fv.file_id = f.id ORDER BY fv.version_number DESC LIMIT 1) as file_size
    FROM files f
    LEFT JOIN users u ON f.uploaded_by = u.id
    WHERE f.project_id = ?
    ORDER BY f.created_at DESC
  `).all(project.id);

  // Get review statuses for each file's latest version per reviewer group
  for (const file of files) {
    file.reviews = {};
    if (file.latest_version_id) {
      const reviews = db.prepare(`
        SELECT r.*, rg.name as group_name
        FROM reviews r
        JOIN reviewer_groups rg ON r.reviewer_group_id = rg.id
        WHERE r.file_version_id = ?
      `).all(file.latest_version_id);
      for (const review of reviews) {
        file.reviews[review.reviewer_group_id] = review;
      }
    }
  }

  const members = db.prepare(`
    SELECT pm.*, u.name, u.email, u.avatar_color
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(project.id);

  res.json({ project, sections, reviewerGroups, files, members });
});

// Update project
router.put('/:id', (req, res) => {
  const { name, description, due_date, status } = req.body;
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      due_date = COALESCE(?, due_date),
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name, description, due_date, status, req.params.id);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project: updated });
});

// Delete project
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ? AND owner_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// --- Sections ---
router.post('/:id/sections', (req, res) => {
  const { name } = req.body;
  const db = getDb();
  const id = uuidv4();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM sections WHERE project_id = ?').get(req.params.id);
  db.prepare('INSERT INTO sections (id, name, project_id, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, name || 'New Section', req.params.id, (maxOrder?.max || 0) + 1);
  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(id);
  res.status(201).json({ section });
});

// --- Reviewer Groups ---
router.post('/:id/reviewer-groups', (req, res) => {
  const { name } = req.body;
  const db = getDb();
  const id = uuidv4();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM reviewer_groups WHERE project_id = ?').get(req.params.id);
  db.prepare('INSERT INTO reviewer_groups (id, name, project_id, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, name || 'New Reviewer Group', req.params.id, (maxOrder?.max || 0) + 1);
  const group = db.prepare('SELECT * FROM reviewer_groups WHERE id = ?').get(id);
  group.members = [];
  res.status(201).json({ reviewerGroup: group });
});

router.post('/:id/reviewer-groups/:groupId/members', (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const db = getDb();
  const memberId = uuidv4();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  db.prepare('INSERT INTO reviewer_group_members (id, group_id, email, name, user_id) VALUES (?, ?, ?, ?, ?)')
    .run(memberId, req.params.groupId, email, name || email.split('@')[0], user?.id || null);
  const member = db.prepare('SELECT * FROM reviewer_group_members WHERE id = ?').get(memberId);
  res.status(201).json({ member });
});

router.delete('/:id/reviewer-groups/:groupId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM reviewer_groups WHERE id = ? AND project_id = ?').run(req.params.groupId, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
