import { Router } from 'express';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/notifications
 * Fetch current user's notifications (newest first)
 */
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (err) {
    console.error('notifications GET error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Quick unread count for badge
 */
router.get('/unread-count', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error('notifications/unread-count error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
router.patch('/read-all', auth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('notifications/read-all error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', auth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('notifications/:id/read error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
