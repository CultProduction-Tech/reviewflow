const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.params.projectId || 'misc');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

function getFileCategory(mimetype, filename) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf') return 'pdf';
  const ext = path.extname(filename).toLowerCase();
  if (['.doc', '.docx', '.txt', '.rtf', '.odt'].includes(ext)) return 'document';
  if (['.ppt', '.pptx', '.key'].includes(ext)) return 'presentation';
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return 'spreadsheet';
  if (['.html', '.htm', '.zip'].includes(ext)) return 'html';
  return 'other';
}

// Upload files to project
router.post('/projects/:projectId/files', authMiddleware, upload.array('files', 50), async (req, res) => {
  const db = getDb();
  const { projectId } = req.params;
  const { section_id } = req.body;

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Get default section if not provided
  let sectionId = section_id;
  if (!sectionId) {
    const section = db.prepare('SELECT id FROM sections WHERE project_id = ? ORDER BY sort_order LIMIT 1').get(projectId);
    sectionId = section?.id;
  }

  const uploadedFiles = [];

  for (const uploadedFile of req.files) {
    const fileId = uuidv4();
    const versionId = uuidv4();
    const fileType = getFileCategory(uploadedFile.mimetype, uploadedFile.originalname);
    const relativePath = path.relative(UPLOAD_DIR, uploadedFile.path).replace(/\\/g, '/');

    db.prepare('INSERT INTO files (id, name, project_id, section_id, uploaded_by) VALUES (?, ?, ?, ?, ?)')
      .run(fileId, uploadedFile.originalname, projectId, sectionId, req.user.id);

    db.prepare(`INSERT INTO file_versions (id, file_id, version_number, file_path, file_type, file_size, original_name, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(versionId, fileId, 1, relativePath, fileType, uploadedFile.size, uploadedFile.originalname, req.user.id);

    // Create reviews for all reviewer groups
    const groups = db.prepare('SELECT id FROM reviewer_groups WHERE project_id = ?').all(projectId);
    for (const group of groups) {
      db.prepare('INSERT INTO reviews (id, file_version_id, reviewer_group_id, status) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), versionId, group.id, 'pending');
    }

    // For images, use the original file as thumbnail
    let thumbnailPath = null;
    if (fileType === 'image') {
      thumbnailPath = relativePath;
      db.prepare('UPDATE file_versions SET thumbnail_path = ? WHERE id = ?').run(thumbnailPath, versionId);
    }

    uploadedFiles.push({
      id: fileId,
      name: uploadedFile.originalname,
      version_id: versionId,
      file_type: fileType,
      file_size: uploadedFile.size,
      thumbnail_path: thumbnailPath
    });
  }

  // Update project timestamp
  db.prepare('UPDATE projects SET updated_at = datetime("now") WHERE id = ?').run(projectId);

  // Log activity
  db.prepare('INSERT INTO activity_log (id, project_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), projectId, req.user.id, 'file_uploaded',
      JSON.stringify({ count: uploadedFiles.length, names: uploadedFiles.map(f => f.name) }));

  res.status(201).json({ files: uploadedFiles });
});

// Upload new version
router.post('/files/:fileId/versions', authMiddleware, upload.single('file'), async (req, res) => {
  const db = getDb();
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const latestVersion = db.prepare(
    'SELECT MAX(version_number) as max FROM file_versions WHERE file_id = ?'
  ).get(file.id);

  const versionId = uuidv4();
  const versionNumber = (latestVersion?.max || 0) + 1;
  const fileType = getFileCategory(req.file.mimetype, req.file.originalname);
  const relativePath = path.relative(UPLOAD_DIR, req.file.path).replace(/\\/g, '/');

  db.prepare(`INSERT INTO file_versions (id, file_id, version_number, file_path, file_type, file_size, original_name, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(versionId, file.id, versionNumber, relativePath, fileType, req.file.size, req.file.originalname, req.user.id);

  // Create reviews for all reviewer groups
  const groups = db.prepare('SELECT id FROM reviewer_groups WHERE project_id = ?').all(file.project_id);
  for (const group of groups) {
    db.prepare('INSERT INTO reviews (id, file_version_id, reviewer_group_id, status) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), versionId, group.id, 'pending');
  }

  // For images, use the original file as thumbnail
  if (fileType === 'image') {
    db.prepare('UPDATE file_versions SET thumbnail_path = ? WHERE id = ?').run(relativePath, versionId);
  }

  db.prepare('UPDATE projects SET updated_at = datetime("now") WHERE id = ?').run(file.project_id);

  const version = db.prepare('SELECT * FROM file_versions WHERE id = ?').get(versionId);
  res.status(201).json({ version });
});

// Get file with all versions
router.get('/files/:fileId', authMiddleware, (req, res) => {
  const db = getDb();
  const file = db.prepare(`
    SELECT f.*, u.name as uploader_name
    FROM files f
    LEFT JOIN users u ON f.uploaded_by = u.id
    WHERE f.id = ?
  `).get(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const versions = db.prepare('SELECT * FROM file_versions WHERE file_id = ? ORDER BY version_number DESC').all(file.id);

  for (const version of versions) {
    version.reviews = db.prepare(`
      SELECT r.*, rg.name as group_name
      FROM reviews r
      JOIN reviewer_groups rg ON r.reviewer_group_id = rg.id
      WHERE r.file_version_id = ?
    `).all(version.id);

    version.comment_count = db.prepare(
      'SELECT COUNT(*) as count FROM comments WHERE file_version_id = ?'
    ).get(version.id).count;
  }

  res.json({ file, versions });
});

// Serve uploaded files
router.get('/uploads/*', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params[0]);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// Delete file
router.delete('/files/:fileId', authMiddleware, (req, res) => {
  const db = getDb();
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found' });

  // Delete physical files
  const versions = db.prepare('SELECT file_path, thumbnail_path FROM file_versions WHERE file_id = ?').all(file.id);
  for (const v of versions) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, v.file_path)); } catch (e) {}
    if (v.thumbnail_path) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, v.thumbnail_path)); } catch (e) {}
    }
  }

  db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
  res.json({ ok: true });
});

module.exports = router;
