import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import adminRouter from './routes/admin.js';
import carsRouter from './routes/cars.js';
import uploadRouter from './routes/upload.js';
import favoritesRouter from './routes/favorites.js';
import callbackRequestsRouter from './routes/callback-requests.js';
import notificationsRouter from './routes/notifications.js';
import ordersRouter from './routes/orders.js';
import chatRouter from './routes/chat.js';
import { sendMail } from './utils/mailer.js';
import pool from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: { origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true },
});
const PORT = process.env.PORT || 4000;

/* ── middleware ── */
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json({ limit: '50mb' }));

/* ── static uploads ── */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ── make io available to routes ── */
app.set('io', io);

/* ── routes ── */
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/admin', adminRouter);
app.use('/api/cars', carsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/callback-requests', callbackRequestsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/chat', chatRouter);

/* ── health check ── */
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

/* ── test email (временный маршрут) ── */
app.get('/api/test-email', async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).json({ error: 'Укажите ?to=email@example.com' });
  try {
    const info = await sendMail({
      to,
      subject: 'Тестовое письмо от AutoSite',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:12px;">
          <h2 style="color:#1a1a2e;">AutoSite</h2>
          <p>Это тестовое письмо. Если вы его видите — SMTP работает!</p>
          <p style="color:#888;font-size:13px;">Отправлено с localhost в ${new Date().toLocaleString('ru-RU')}</p>
        </div>
      `,
    });
    res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error('Mail error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── Socket.IO ── */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const guestId = socket.handshake.auth?.guestId;

  if (token) {
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  }

  if (guestId) {
    socket.user = { id: null, role: 'guest', guestId };
    return next();
  }

  return next(new Error('No token or guest ID'));
});

io.on('connection', async (socket) => {
  const { id: userId, role, guestId } = socket.user;

  /* Admin joins a special admin room */
  if (role === 'admin') {
    socket.join('admins');
    console.log(`[Socket] Admin connected: id=${userId}, socketId=${socket.id}`);
  }

  /* User joins their own chat room */
  if (role === 'guest' && guestId) {
    const guestRoom = (await pool.query('SELECT id FROM chat_rooms WHERE guest_id = $1', [guestId]).catch(() => ({ rows: [] }))).rows[0];
    if (guestRoom) {
      socket.join(`room:${guestRoom.id}`);
    }
  } else if (userId) {
    const roomRow = (await pool.query('SELECT id FROM chat_rooms WHERE user_id = $1', [userId]).catch(() => ({ rows: [] }))).rows[0];
    if (roomRow) {
      socket.join(`room:${roomRow.id}`);
    }
  }

  /* When user/admin sends a message via socket */
  socket.on('chat:send', async ({ roomId, text, asAdmin }) => {
    if (!text?.trim()) return;
    try {
      /* Verify access */
      const room = (await pool.query('SELECT * FROM chat_rooms WHERE id = $1', [roomId])).rows[0];
      if (!room) return;
      // Check access: admin, owner, or guest owner
      if (role !== 'admin' && role !== 'guest' && room.user_id !== userId) return;
      if (role === 'guest' && room.guest_id !== guestId) return;

      const isAdminReply = !!(asAdmin && role === 'admin');

      /* Save message */
      await pool.query('UPDATE chat_rooms SET updated_at = NOW() WHERE id = $1', [roomId]);

      let msg;
      if (role === 'guest') {
        const { rows } = await pool.query(
          'INSERT INTO chat_messages (room_id, sender_id, text, is_admin_reply, guest_id) VALUES ($1, NULL, $2, false, $3) RETURNING *',
          [roomId, text.trim(), guestId]
        );
        msg = rows[0];
        msg.sender_name = 'Гость';
        msg.sender_role = 'guest';
      } else {
        const { rows } = await pool.query(
          'INSERT INTO chat_messages (room_id, sender_id, text, is_admin_reply) VALUES ($1, $2, $3, $4) RETURNING *',
          [roomId, userId, text.trim(), isAdminReply]
        );
        msg = rows[0];
        const sender = (await pool.query('SELECT name, role FROM users WHERE id = $1', [userId])).rows[0];
        msg.sender_name = sender.name;
        msg.sender_role = sender.role;
      }

      /* Broadcast to room + admins */
      io.to(`room:${roomId}`).emit('chat:message', msg);
      io.to('admins').emit('chat:message', msg);
    } catch (err) {
      console.error('chat:send error:', err.message);
    }
  });

  /* Join a specific room (so they get real-time messages) */
  socket.on('chat:join', ({ roomId }) => {
    socket.join(`room:${roomId}`);
  });

  /* Mark messages as read */
  socket.on('chat:read', async ({ roomId }) => {
    try {
      if (role === 'guest') {
        await pool.query(
          'UPDATE chat_messages SET is_read = true WHERE room_id = $1 AND is_admin_reply = true AND is_read = false',
          [roomId]
        );
      } else {
        await pool.query(
          `UPDATE chat_messages SET is_read = true WHERE room_id = $1 AND sender_id != $2 AND is_read = false`,
          [roomId, userId]
        );
      }
      io.to(`room:${roomId}`).emit('chat:read', { roomId, readBy: userId || guestId });
      io.to('admins').emit('chat:read', { roomId, readBy: userId || guestId });
    } catch (err) {
      console.error('chat:read error:', err.message);
    }
  });

  /* Typing indicator */
  socket.on('chat:typing', ({ roomId }) => {
    socket.to(`room:${roomId}`).emit('chat:typing', { roomId, userId, role });
    socket.to('admins').emit('chat:typing', { roomId, userId, role });
  });
});

/* ── start ── */
httpServer.listen(PORT, () => {
  console.log(`🚀  Server running on http://localhost:${PORT}`);
});
