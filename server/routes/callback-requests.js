import { Router } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';
import { sendMail } from '../utils/mailer.js';

const router = Router();

/* ── helpers ── */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

/** Optional auth — sets req.user if valid token present, otherwise continues */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    } catch { /* ignore invalid token */ }
  }
  next();
}

/* ────────────────────── PUBLIC ────────────────────── */

/**
 * POST /api/callback-requests
 * Submit a new callback request (no auth required)
 * Body: { type, name, phone, email?, car_id?, car_name?, topic?, order_number?, message? }
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { type = 'simple', name, phone, email, car_id, car_name, topic, order_number, message } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Имя и телефон обязательны' });
    }

    const validTypes = ['simple', 'car', 'question', 'order', 'quiz'];
    const safeType = validTypes.includes(type) ? type : 'simple';
    const userId = req.user?.id || null;

    /* Detect source: Capacitor webview origins or UA → mobile, else web */
    const origin = req.headers.origin || '';
    const ua = req.headers['user-agent'] || '';
    const mobileOrigins = ['capacitor://localhost', 'https://localhost', 'http://localhost'];
    const isMobile = mobileOrigins.includes(origin) || /Capacitor/i.test(ua);
    const source = isMobile ? 'mobile' : 'web';

    const { rows } = await pool.query(
      `INSERT INTO callback_requests (type, name, phone, email, car_id, car_name, topic, order_number, message, user_id, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [safeType, name.trim(), phone.trim(), email?.trim() || null, car_id || null, car_name?.trim() || null, topic?.trim() || null, order_number?.trim() || null, message?.trim() || null, userId, source]
    );

    /* Notify admins via socket */
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('admin:new-request', rows[0]);
    }

    res.status(201).json({ request: rows[0] });
  } catch (err) {
    console.error('callback-requests POST error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ────────────────────── USER (my requests) ────────────────────── */

/**
 * GET /api/callback-requests/my
 * Fetch the authenticated user's own requests
 */
router.get('/my', auth, async (req, res) => {
  try {
    const { type } = req.query;
    let sql = `SELECT cr.*, c.name AS linked_car_name, c.brand AS linked_car_brand,
                      c.year AS linked_car_year,
                      c.image AS linked_car_image
               FROM callback_requests cr
               LEFT JOIN cars c ON c.id = cr.car_id
               WHERE cr.user_id = $1`;
    const params = [req.user.id];
    if (type) {
      params.push(type);
      sql += ` AND cr.type = $${params.length}`;
    }
    sql += ' ORDER BY cr.created_at DESC';
    const { rows } = await pool.query(sql, params);
    res.json({ requests: rows });
  } catch (err) {
    console.error('callback-requests/my GET error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ────────────────────── ADMIN ────────────────────── */

/**
 * GET /api/callback-requests
 * List all requests with pagination + optional filters
 * Query: page, limit, type, status, search
 */
router.get('/', auth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { type, status, search } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (type) {
      conditions.push(`cr.type = $${idx++}`);
      params.push(type);
    }
    if (status) {
      conditions.push(`cr.status = $${idx++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(cr.name ILIKE $${idx} OR cr.phone ILIKE $${idx} OR cr.email ILIKE $${idx} OR cr.car_name ILIKE $${idx} OR cr.message ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (req.query.claimed_by) {
      conditions.push(`cr.claimed_by = $${idx++}`);
      params.push(Number(req.query.claimed_by));
    }
    if (req.query.source) {
      conditions.push(`cr.source = $${idx++}`);
      params.push(req.query.source);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count FROM callback_requests cr ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const { rows } = await pool.query(
      `SELECT cr.*, c.name AS linked_car_name, c.brand AS linked_car_brand,
              COALESCE(cu.nickname, cu.name) AS claimed_by_name, cu.email AS claimed_by_email
       FROM callback_requests cr
       LEFT JOIN cars c ON c.id = cr.car_id
       LEFT JOIN users cu ON cu.id = cr.claimed_by
       ${where}
       ORDER BY cr.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      requests: rows,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('callback-requests GET error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/callback-requests/stats
 * Quick counts for dashboard
 */
router.get('/stats', auth, requireAdmin, async (req, res) => {
  try {
    const where = req.query.source ? 'WHERE source = $1' : '';
    const params = req.query.source ? [req.query.source] : [];
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
        COUNT(*) FILTER (WHERE status = 'processed')::int AS processed_count,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_count,
        COUNT(*) FILTER (WHERE type = 'simple')::int AS simple_count,
        COUNT(*) FILTER (WHERE type = 'car')::int AS car_count,
        COUNT(*) FILTER (WHERE type = 'question')::int AS question_count,
        COUNT(*) FILTER (WHERE source = 'mobile')::int AS mobile_count,
        COUNT(*) FILTER (WHERE source = 'web')::int AS web_count
      FROM callback_requests ${where}
    `, params);
    res.json(rows[0]);
  } catch (err) {
    console.error('callback-requests/stats error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/callback-requests/:id/claim
 * Admin claims (takes responsibility for) a request
 */
router.patch('/:id/claim', auth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE callback_requests SET claimed_by = $1, claimed_at = NOW() WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }
    /* Get admin name */
    const admin = (await pool.query('SELECT nickname, name, email FROM users WHERE id = $1', [req.user.id])).rows[0];
    const request = rows[0];
    request.claimed_by_name = admin?.nickname || admin?.name || admin?.email || 'Admin';
    res.json({ request });
  } catch (err) {
    console.error('callback-requests CLAIM error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PATCH /api/callback-requests/:id
 * Update status of a request
 */
router.patch('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const status = req.body?.status;
    const validStatuses = ['new', 'processed', 'closed', 'autoresponder', 'messenger'];
    if (!validStatuses.includes(status)) {
      console.error(`PATCH /callback-requests/${req.params.id}: invalid status="${status}", body=`, req.body);
      return res.status(400).json({ error: `Недопустимый статус: ${status}` });
    }

    const { rows } = await pool.query(
      'UPDATE callback_requests SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const request = rows[0];
    const isOrder = request.type === 'order';

    /* ── Create notification for the owner ── */
    if (request.user_id) {
      const statusLabels = { new: 'Новая', processed: 'В обработке', closed: 'Закрыта', autoresponder: 'Автоответчик', messenger: 'Мессенджер' };
      const orderStatusLabels = { new: 'Новый', processed: 'В обработке', closed: 'Завершён', autoresponder: 'Автоответчик', messenger: 'Мессенджер' };
      const labels = isOrder ? orderStatusLabels : statusLabels;

      let title, message, link;

      if (isOrder) {
        title = `Статус заказа #${request.id} изменён`;
        message = `Ваш заказ на ${request.car_name || 'автомобиль'} теперь имеет статус «${labels[status] || status}».`;
        link = '/cabinet/orders';
      } else {
        const typeName = request.type === 'car' ? `на авто ${request.car_name || ''}`.trim()
          : request.type === 'question' ? 'вопрос'
          : 'обратный звонок';
        title = `Статус заявки изменён на «${labels[status] || status}»`;
        message = `Ваша заявка (${typeName}) теперь имеет статус «${labels[status] || status}».`;
        link = '/cabinet/requests';
      }

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, 'status_change', $2, $3, $4)`,
        [request.user_id, title, message, link]
      ).catch(err => console.error('Failed to create notification:', err.message));

      /* Dispatch browser event so badge updates instantly */
    }

    /* ── Send email for orders ── */
    if (isOrder && request.email) {
      const orderStatusLabels = { new: 'Новый', processed: 'В обработке', closed: 'Завершён' };
      const statusColors = { new: '#eab308', processed: '#2563eb', closed: '#22c55e' };
      const statusEmoji = { new: '🕐', processed: '⚙️', closed: '✅' };

      /* Get car info for the email card */
      let car = null;
      if (request.car_id) {
        const carResult = await pool.query('SELECT * FROM cars WHERE id = $1', [request.car_id]);
        if (carResult.rows.length) car = carResult.rows[0];
      }

      const carCardHtml = car ? `
        <div style="background:#f8f9fc;border-radius:12px;overflow:hidden;border:1px solid #eee;margin:20px 0;">
          ${car.image ? `<img src="${car.image}" alt="${car.name}" style="width:100%;max-height:220px;object-fit:cover;display:block;" />` : ''}
          <div style="padding:16px 20px;">
            <h3 style="margin:0 0 4px;color:#222;font-size:16px;">${car.name}</h3>
            ${car.spec ? `<p style="color:#888;font-size:13px;margin:0 0 8px;">${car.spec}</p>` : ''}
            <p style="color:#1a1a2e;font-size:20px;font-weight:700;margin:0;">${Number(car.price).toLocaleString('ru-RU')} ₽</p>
          </div>
        </div>
      ` : '';

      const statusText = orderStatusLabels[status] || status;
      const statusColor = statusColors[status] || '#666';
      const emoji = statusEmoji[status] || '';

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
          <div style="background:#1a1a2e;padding:24px 32px;">
            <h1 style="color:#fff;font-size:22px;margin:0;">TitaniumDrive</h1>
          </div>
          <div style="padding:28px 32px;">
            <h2 style="color:#222;font-size:20px;margin:0 0 16px;">${emoji} Статус заказа обновлён</h2>

            <div style="background:${statusColor}15;border-left:4px solid ${statusColor};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px;">
              <p style="margin:0;font-size:14px;color:#555;">
                Заказ <strong>#${request.id}</strong> — новый статус:
              </p>
              <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:${statusColor};">
                ${statusText}
              </p>
            </div>

            ${status === 'processed' ? '<p style="color:#666;font-size:15px;line-height:1.5;margin:0 0 8px;">Ваш заказ взят в работу! Менеджер уже занимается вашим запросом и скоро свяжется с вами.</p>' : ''}
            ${status === 'closed' ? '<p style="color:#666;font-size:15px;line-height:1.5;margin:0 0 8px;">Ваш заказ завершён. Спасибо, что выбрали нас! Если у вас есть вопросы — не стесняйтесь обращаться.</p>' : ''}
            ${status === 'new' ? '<p style="color:#666;font-size:15px;line-height:1.5;margin:0 0 8px;">Статус вашего заказа был обновлён. Мы свяжемся с вами в ближайшее время.</p>' : ''}

            ${carCardHtml}

            <p style="color:#aaa;font-size:13px;margin:20px 0 0;line-height:1.5;">
              Номер заказа: <strong>#${request.id}</strong><br/>
              Имя: ${request.name}<br/>
              Телефон: ${request.phone}
            </p>
          </div>
          <div style="background:#f8f9fc;padding:16px 32px;border-top:1px solid #eee;">
            <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">© TitaniumDrive — автомобили с гарантией</p>
          </div>
        </div>
      `;

      sendMail({
        to: request.email,
        subject: `Заказ #${request.id} — статус: ${statusText}`,
        html: emailHtml,
      }).catch(err => console.error('Failed to send order status email:', err.message));
    }

    res.json({ request });
  } catch (err) {
    console.error('callback-requests PATCH error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/callback-requests/:id
 */
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM callback_requests WHERE id = $1',
      [req.params.id]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('callback-requests DELETE error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
