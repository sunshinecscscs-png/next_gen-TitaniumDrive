import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 10;

/* ── Middleware: только admin ── */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

/* ───── GET /api/admin/has-admin ─────
   Публичный: проверяет есть ли хоть один админ */
router.get('/has-admin', async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    res.json({ hasAdmin: Number(rows[0].count) > 0 });
  } catch (err) {
    console.error('Has-admin error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── POST /api/admin/setup ─────
   Публичный: создаёт первого админа (работает ТОЛЬКО если админов нет) */
router.post('/setup', async (req, res) => {
  try {
    const existing = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.rows.length) {
      return res.status(403).json({ error: 'Администратор уже существует. Используйте вход.' });
    }

    const { name, email, password, nickname } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль не менее 6 символов' });
    }

    // Если пользователь существует — обновить роль
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let user;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    if (existingUser.rows.length) {
      const { rows } = await pool.query(
        "UPDATE users SET role = 'admin', password_hash = $1, name = $2, nickname = $3, updated_at = NOW() WHERE email = $4 RETURNING id, name, email, role, nickname, created_at",
        [passwordHash, name, nickname?.trim() || null, email],
      );
      user = rows[0];
    } else {
      const { rows } = await pool.query(
        "INSERT INTO users (name, email, password_hash, role, nickname) VALUES ($1, $2, $3, 'admin', $4) RETURNING id, name, email, role, nickname, created_at",
        [name, email, passwordHash, nickname?.trim() || null],
      );
      user = rows[0];
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Admin setup error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── POST /api/admin/register ─────
   Публичный: регистрация нового админа */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, nickname } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль не менее 6 символов' });
    }

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Пользователь с этим email уже существует' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, nickname) VALUES ($1, $2, $3, 'admin', $4) RETURNING id, name, email, role, nickname, created_at",
      [name, email, passwordHash, nickname?.trim() || null],
    );
    const user = rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Admin register error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── POST /api/admin/create-admin ─────
   Защищённый: создаёт нового админа */
router.post('/create-admin', auth, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, nickname } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль не менее 6 символов' });
    }

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Пользователь с этим email уже существует' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, nickname) VALUES ($1, $2, $3, 'admin', $4) RETURNING id, name, email, role, nickname, created_at",
      [name, email, passwordHash, nickname?.trim() || null],
    );

    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── GET /api/admin/admins-list ─────
   Returns a list of all admins (id, nickname, name) for filter dropdowns */
router.get('/admins-list', auth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, nickname, name, email FROM users WHERE role = 'admin' ORDER BY nickname, name"
    );
    res.json({ admins: rows });
  } catch (err) {
    console.error('Admins list error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── GET /api/admin/stats ───── */
router.get('/stats', auth, requireAdmin, async (_req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) AS count FROM users');
    const adminsCount = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    const todayCount = await pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at::date = CURRENT_DATE");
    const carsCount = await pool.query('SELECT COUNT(*) AS count FROM cars');
    const carsPublished = await pool.query('SELECT COUNT(*) AS count FROM cars WHERE is_published = true');
    res.json({
      totalUsers: Number(usersCount.rows[0].count),
      totalAdmins: Number(adminsCount.rows[0].count),
      registeredToday: Number(todayCount.rows[0].count),
      totalCars: Number(carsCount.rows[0].count),
      publishedCars: Number(carsPublished.rows[0].count),
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── GET /api/admin/users ───── */
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let where = '';
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE name ILIKE $1 OR surname ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1`;
    }

    const countQuery = `SELECT COUNT(*) AS count FROM users ${where}`;
    const dataQuery = `SELECT id, name, surname, patronymic, email, phone, address, birth_date, gender, role, created_at, updated_at
                       FROM users ${where}
                       ORDER BY created_at DESC
                       LIMIT ${limit} OFFSET ${offset}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, params),
    ]);

    res.json({
      users: dataRes.rows,
      total: Number(countRes.rows[0].count),
      page,
      pages: Math.ceil(Number(countRes.rows[0].count) / limit),
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── GET /api/admin/users/:id ───── */
router.get('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, surname, patronymic, email, phone, address, birth_date, gender, role, created_at, updated_at FROM users WHERE id = $1',
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Admin user detail error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── PUT /api/admin/users/:id/role ───── */
router.put('/users/:id/role', auth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Роль должна быть user или admin' });
    }
    // Нельзя снять роль с самого себя
    if (Number(req.params.id) === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Нельзя снять роль админа с самого себя' });
    }
    const { rows } = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role',
      [role, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Admin role error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── DELETE /api/admin/users/:id ───── */
router.delete('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin delete error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
