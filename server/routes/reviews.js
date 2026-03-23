import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'reviews');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const router = Router();

/* Middleware: только admin */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

/* Multer storage */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ───── GET /api/reviews — публичный список отзывов ───── */
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM reviews WHERE is_published = true ORDER BY created_at DESC'
    );
    res.json({ reviews: rows });
  } catch (err) {
    console.error('Reviews list error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── GET /api/reviews/admin — все отзывы для админки ───── */
router.get('/admin', auth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const [countRes, dataRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM reviews'),
      pool.query('SELECT * FROM reviews ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
    ]);

    res.json({
      reviews: dataRes.rows,
      total: Number(countRes.rows[0].count),
      page,
      pages: Math.ceil(Number(countRes.rows[0].count) / limit),
    });
  } catch (err) {
    console.error('Admin reviews error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── POST /api/reviews — создать отзыв (admin) ───── */
router.post(
  '/',
  auth,
  requireAdmin,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { first_name, last_name, rating, text, is_published } = req.body;

      if (!first_name || !rating || !text) {
        return res.status(400).json({ error: 'Имя, рейтинг и текст обязательны' });
      }

      const ratingNum = Math.min(5, Math.max(1, Number(rating)));
      const avatarUrl = req.files?.avatar?.[0] ? `/uploads/reviews/${req.files.avatar[0].filename}` : null;
      const photoUrl = req.files?.photo?.[0] ? `/uploads/reviews/${req.files.photo[0].filename}` : null;

      const { rows } = await pool.query(
        `INSERT INTO reviews (first_name, last_name, avatar_url, rating, text, photo_url, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          first_name.trim(),
          last_name?.trim() || null,
          avatarUrl,
          ratingNum,
          text.trim(),
          photoUrl,
          is_published === 'false' ? false : true,
        ]
      );

      res.status(201).json({ review: rows[0] });
    } catch (err) {
      console.error('Create review error:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

/* ───── PUT /api/reviews/:id — обновить отзыв (admin) ───── */
router.put(
  '/:id',
  auth,
  requireAdmin,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { first_name, last_name, rating, text, is_published, remove_avatar, remove_photo } = req.body;

      if (!first_name || !rating || !text) {
        return res.status(400).json({ error: 'Имя, рейтинг и текст обязательны' });
      }

      const ratingNum = Math.min(5, Math.max(1, Number(rating)));

      // Get current review to handle file cleanup
      const current = await pool.query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
      if (!current.rows.length) return res.status(404).json({ error: 'Отзыв не найден' });

      let avatarUrl = current.rows[0].avatar_url;
      let photoUrl = current.rows[0].photo_url;

      // Handle avatar
      if (req.files?.avatar?.[0]) {
        if (avatarUrl) deleteFile(avatarUrl);
        avatarUrl = `/uploads/reviews/${req.files.avatar[0].filename}`;
      } else if (remove_avatar === 'true') {
        if (avatarUrl) deleteFile(avatarUrl);
        avatarUrl = null;
      }

      // Handle photo
      if (req.files?.photo?.[0]) {
        if (photoUrl) deleteFile(photoUrl);
        photoUrl = `/uploads/reviews/${req.files.photo[0].filename}`;
      } else if (remove_photo === 'true') {
        if (photoUrl) deleteFile(photoUrl);
        photoUrl = null;
      }

      const { rows } = await pool.query(
        `UPDATE reviews SET first_name=$1, last_name=$2, avatar_url=$3, rating=$4, text=$5, photo_url=$6, is_published=$7, updated_at=NOW()
         WHERE id=$8 RETURNING *`,
        [
          first_name.trim(),
          last_name?.trim() || null,
          avatarUrl,
          ratingNum,
          text.trim(),
          photoUrl,
          is_published === 'false' ? false : true,
          req.params.id,
        ]
      );

      res.json({ review: rows[0] });
    } catch (err) {
      console.error('Update review error:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

/* ───── DELETE /api/reviews/:id — удалить отзыв (admin) ───── */
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const current = await pool.query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Отзыв не найден' });

    // Clean up files
    if (current.rows[0].avatar_url) deleteFile(current.rows[0].avatar_url);
    if (current.rows[0].photo_url) deleteFile(current.rows[0].photo_url);

    await pool.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── PATCH /api/reviews/:id/publish — toggle publish (admin) ───── */
router.patch('/:id/publish', auth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE reviews SET is_published = NOT is_published, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Отзыв не найден' });
    res.json({ review: rows[0] });
  } catch (err) {
    console.error('Toggle review publish error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* Helper: delete uploaded file */
function deleteFile(urlPath) {
  try {
    const fullPath = path.join(__dirname, '..', urlPath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch { /* ignore */ }
}

export default router;
