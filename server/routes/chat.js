import { Router } from 'express';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';

const router = Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
  next();
}

/* ════════════════════ USER endpoints ════════════════════ */

/**
 * GET /api/chat/my
 * Get or create the current user's chat room + messages
 */
router.get('/my', auth, async (req, res) => {
  try {
    /* Find room (do NOT create — room is created on first message) */
    const room = (await pool.query('SELECT * FROM chat_rooms WHERE user_id = $1', [req.user.id])).rows[0];
    if (!room) {
      return res.json({ room: null, messages: [] });
    }

    /* Get messages */
    const { rows: messages } = await pool.query(
      `SELECT m.*, 
              COALESCE(u.name, 'Гость') AS sender_name,
              COALESCE(u.role, 'guest') AS sender_role
       FROM chat_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.room_id = $1
       ORDER BY m.created_at ASC`,
      [room.id]
    );

    res.json({ room, messages });
  } catch (err) {
    console.error('chat/my GET error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/chat/my/send
 * Send a message in user's own chat room
 */
router.post('/my/send', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Пустое сообщение' });

    /* Find or create room */
    let room = (await pool.query('SELECT * FROM chat_rooms WHERE user_id = $1', [req.user.id])).rows[0];
    if (!room) {
      room = (await pool.query(
        'INSERT INTO chat_rooms (user_id) VALUES ($1) RETURNING *',
        [req.user.id]
      )).rows[0];
    }

    /* Update room timestamp */
    await pool.query('UPDATE chat_rooms SET updated_at = NOW() WHERE id = $1', [room.id]);

    /* Insert message */
    const { rows } = await pool.query(
      `INSERT INTO chat_messages (room_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *`,
      [room.id, req.user.id, text.trim()]
    );
    const msg = rows[0];

    /* Attach sender info */
    const user = (await pool.query('SELECT name, role FROM users WHERE id = $1', [req.user.id])).rows[0];
    msg.sender_name = user.name;
    msg.sender_role = user.role;

    /* Notify via socket */
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${room.id}`).emit('chat:message', msg);
      io.to('admins').emit('chat:message', msg);
    }

    res.status(201).json({ message: msg });
  } catch (err) {
    console.error('chat/my/send POST error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/chat/my/read
 * Mark all admin messages as read in user's room
 */
router.patch('/my/read', auth, async (req, res) => {
  try {
    const room = (await pool.query('SELECT id FROM chat_rooms WHERE user_id = $1', [req.user.id])).rows[0];
    if (!room) return res.json({ ok: true });

    await pool.query(
      `UPDATE chat_messages SET is_read = true
       WHERE room_id = $1 AND sender_id != $2 AND is_read = false`,
      [room.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('chat/my/read PATCH error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ════════════════════ GUEST endpoints ════════════════════ */

/**
 * GET /api/chat/guest
 * Get or create a guest chat room + messages (identified by x-guest-id header)
 */
router.get('/guest', async (req, res) => {
  try {
    const guestId = req.headers['x-guest-id'];
    if (!guestId) return res.status(400).json({ error: 'Нет guest ID' });

    /* Find room (do NOT create — room is created on first message) */
    const room = (await pool.query('SELECT * FROM chat_rooms WHERE guest_id = $1', [guestId])).rows[0];
    if (!room) {
      return res.json({ room: null, messages: [] });
    }

    /* Get messages */
    const { rows: messages } = await pool.query(
      `SELECT m.*, 
              COALESCE(u.name, 'Гость') AS sender_name,
              COALESCE(u.role, 'guest') AS sender_role
       FROM chat_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.room_id = $1
       ORDER BY m.created_at ASC`,
      [room.id]
    );

    res.json({ room, messages });
  } catch (err) {
    console.error('chat/guest GET error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/chat/guest/send
 * Send a message as a guest
 */
router.post('/guest/send', async (req, res) => {
  try {
    const guestId = req.headers['x-guest-id'];
    if (!guestId) return res.status(400).json({ error: 'Нет guest ID' });

    const { text, guestName, guestPhone, guestEmail, guestCity } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Пустое сообщение' });

    /* Find or create room */
    let room = (await pool.query('SELECT * FROM chat_rooms WHERE guest_id = $1', [guestId])).rows[0];
    if (!room) {
      room = (await pool.query(
        'INSERT INTO chat_rooms (guest_id, guest_name, guest_phone, guest_email, guest_city, guest_country, guest_country_code) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [guestId, guestName || 'Гость', guestPhone || null, guestEmail || null, guestCity || null, req.body.guestCountry || null, req.body.guestCountryCode || null]
      )).rows[0];
    }

    /* Update room timestamp */
    await pool.query('UPDATE chat_rooms SET updated_at = NOW() WHERE id = $1', [room.id]);

    /* Insert message (sender_id NULL for guest) */
    const { rows } = await pool.query(
      'INSERT INTO chat_messages (room_id, sender_id, text, guest_id) VALUES ($1, NULL, $2, $3) RETURNING *',
      [room.id, text.trim(), guestId]
    );
    const msg = rows[0];
    msg.sender_name = 'Гость';
    msg.sender_role = 'guest';

    /* Notify via socket */
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${room.id}`).emit('chat:message', msg);
      io.to('admins').emit('chat:message', msg);
    }

    res.status(201).json({ message: msg });
  } catch (err) {
    console.error('chat/guest/send POST error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/chat/guest/contact
 * Save guest contact info (name, phone, email)
 */
router.patch('/guest/contact', async (req, res) => {
  try {
    const guestId = req.headers['x-guest-id'];
    if (!guestId) return res.status(400).json({ error: 'Нет guest ID' });

    const { name, phone, email, city, country, countryCode } = req.body;

    const room = (await pool.query('SELECT id FROM chat_rooms WHERE guest_id = $1', [guestId])).rows[0];
    if (room) {
      await pool.query(
        'UPDATE chat_rooms SET guest_name = COALESCE($1, guest_name), guest_phone = COALESCE($2, guest_phone), guest_email = COALESCE($3, guest_email), guest_city = COALESCE($4, guest_city), guest_country = COALESCE($5, guest_country), guest_country_code = COALESCE($6, guest_country_code) WHERE id = $7',
        [name || null, phone || null, email || null, city || null, country || null, countryCode || null, room.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('chat/guest/contact PATCH error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/chat/guest/read
 * Mark all admin messages as read in guest's room
 */
router.patch('/guest/read', async (req, res) => {
  try {
    const guestId = req.headers['x-guest-id'];
    if (!guestId) return res.status(400).json({ error: 'Нет guest ID' });

    const room = (await pool.query('SELECT id FROM chat_rooms WHERE guest_id = $1', [guestId])).rows[0];
    if (!room) return res.json({ ok: true });

    await pool.query(
      'UPDATE chat_messages SET is_read = true WHERE room_id = $1 AND is_admin_reply = true AND is_read = false',
      [room.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('chat/guest/read PATCH error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ════════════════════ ADMIN endpoints ════════════════════ */

/**
 * GET /api/chat/rooms
 * List all chat rooms (admin)
 */
router.get('/rooms', auth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, 
              COALESCE(u.name, r.guest_name, 'Гость') AS user_name,
              COALESCE(u.email, '') AS user_email,
              COALESCE(cu.nickname, cu.name) AS claimed_by_name, cu.email AS claimed_by_email,
              (SELECT COUNT(*)::int FROM chat_messages m WHERE m.room_id = r.id AND m.is_read = false AND m.is_admin_reply = false) AS unread_count,
              (SELECT m.text FROM chat_messages m WHERE m.room_id = r.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT m.created_at FROM chat_messages m WHERE m.room_id = r.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
       FROM chat_rooms r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN users cu ON cu.id = r.claimed_by
       WHERE EXISTS (SELECT 1 FROM chat_messages m WHERE m.room_id = r.id)
       ORDER BY last_message_at DESC NULLS LAST`
    );
    res.json({ rooms: rows });
  } catch (err) {
    console.error('chat/rooms GET error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/chat/rooms/:roomId/claim
 * Admin claims (takes responsibility for) a chat room
 */
router.patch('/rooms/:roomId/claim', auth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE chat_rooms SET claimed_by = $1, claimed_at = NOW() WHERE id = $2 RETURNING *',
      [req.user.id, req.params.roomId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Чат не найден' });
    const admin = (await pool.query('SELECT nickname, name, email FROM users WHERE id = $1', [req.user.id])).rows[0];
    const room = rows[0];
    room.claimed_by_name = admin?.nickname || admin?.name || admin?.email || 'Admin';
    res.json({ room });
  } catch (err) {
    console.error('chat/rooms/:id/claim PATCH error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/chat/rooms/:roomId/messages
 * Get messages for a specific room (admin)
 */
router.get('/rooms/:roomId/messages', auth, requireAdmin, async (req, res) => {
  try {
    const { rows: messages } = await pool.query(
      `SELECT m.*, 
              COALESCE(u.name, 'Гость') AS sender_name,
              COALESCE(u.role, 'guest') AS sender_role
       FROM chat_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.room_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.roomId]
    );
    res.json({ messages });
  } catch (err) {
    console.error('chat/rooms/:id/messages GET error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/chat/rooms/:roomId/send
 * Admin sends a message in a room
 */
router.post('/rooms/:roomId/send', auth, requireAdmin, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Пустое сообщение' });

    const roomId = req.params.roomId;

    /* Verify room exists */
    const room = (await pool.query('SELECT * FROM chat_rooms WHERE id = $1', [roomId])).rows[0];
    if (!room) return res.status(404).json({ error: 'Чат не найден' });

    /* Update room timestamp */
    await pool.query('UPDATE chat_rooms SET updated_at = NOW() WHERE id = $1', [roomId]);

    /* Insert message */
    const { rows } = await pool.query(
      `INSERT INTO chat_messages (room_id, sender_id, text, is_admin_reply) VALUES ($1, $2, $3, true) RETURNING *`,
      [roomId, req.user.id, text.trim()]
    );
    const msg = rows[0];

    const user = (await pool.query('SELECT name, role FROM users WHERE id = $1', [req.user.id])).rows[0];
    msg.sender_name = user.name;
    msg.sender_role = user.role;

    /* Notify via socket */
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${roomId}`).emit('chat:message', msg);
      io.to('admins').emit('chat:message', msg);
    }

    res.status(201).json({ message: msg });
  } catch (err) {
    console.error('chat/rooms/:id/send POST error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/chat/rooms/:roomId/read
 * Admin marks all user messages as read in a room
 */
router.patch('/rooms/:roomId/read', auth, requireAdmin, async (req, res) => {
  try {
    const roomId = req.params.roomId;
    await pool.query(
      `UPDATE chat_messages SET is_read = true
       WHERE room_id = $1 AND is_read = false AND (sender_id IS NULL OR sender_id != $2)`,
      [roomId, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('chat/rooms/:id/read PATCH error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/chat/rooms/empty
 * Remove all chat rooms that have zero messages (admin cleanup)
 */
router.delete('/rooms/empty', auth, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM chat_rooms
       WHERE NOT EXISTS (SELECT 1 FROM chat_messages m WHERE m.room_id = chat_rooms.id)`
    );
    res.json({ deleted: rowCount });
  } catch (err) {
    console.error('chat/rooms/empty DELETE error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/chat/unread-total
 * Total unread messages across all rooms (for admin badge)
 */
router.get('/unread-total', auth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM chat_messages m
       JOIN chat_rooms r ON r.id = m.room_id
       WHERE m.is_read = false AND m.is_admin_reply = false`
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error('chat/unread-total error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ════════════════════ RATING endpoints ════════════════════ */

/**
 * POST /api/chat/my/rate
 * User rates their own chat
 */
router.post('/my/rate', auth, async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Неверная оценка' });

    const room = (await pool.query('SELECT id FROM chat_rooms WHERE user_id = $1', [req.user.id])).rows[0];
    if (!room) return res.status(404).json({ error: 'Чат не найден' });

    await pool.query('UPDATE chat_rooms SET rating = $1, rated_at = NOW() WHERE id = $2', [rating, room.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('chat/my/rate error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/chat/guest/rate
 * Guest rates their own chat
 */
router.post('/guest/rate', async (req, res) => {
  try {
    const guestId = req.headers['x-guest-id'];
    if (!guestId) return res.status(400).json({ error: 'Нет guest ID' });

    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Неверная оценка' });

    const room = (await pool.query('SELECT id FROM chat_rooms WHERE guest_id = $1', [guestId])).rows[0];
    if (!room) return res.status(404).json({ error: 'Чат не найден' });

    await pool.query('UPDATE chat_rooms SET rating = $1, rated_at = NOW() WHERE id = $2', [rating, room.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('chat/guest/rate error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
