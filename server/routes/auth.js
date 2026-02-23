import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';
import { sendMail, generateCode } from '../utils/mailer.js';

const router = Router();
const SALT_ROUNDS = 10;

/* Хранилище кодов верификации (в памяти, TTL 10 мин) */
const pendingCodes = new Map(); // email → { code, name, password, phone, expiresAt }

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN },
  );
}

/* ───── POST /api/auth/send-code ─────
   Шаг 1: проверяет данные, отправляет код на email */
router.post('/send-code', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    // проверка дубликата
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const code = generateCode();
    pendingCodes.set(email, {
      code,
      name,
      password,
      phone: phone || null,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 минут
    });

    await sendMail({
      to: email,
      subject: 'Код подтверждения регистрации — AutoSite',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;border:1px solid #eee;border-radius:12px;">
          <h2 style="color:#1a1a2e;margin-top:0;">AutoSite</h2>
          <p>Ваш код подтверждения:</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px 0;color:#1a1a2e;">${code}</div>
          <p style="color:#888;font-size:13px;">Код действителен 10 минут. Если вы не регистрировались — проигнорируйте это письмо.</p>
        </div>
      `,
    });

    res.json({ ok: true, message: 'Код отправлен на ' + email });
  } catch (err) {
    console.error('Send-code error:', err);
    res.status(500).json({ error: 'Не удалось отправить код' });
  }
});

/* ───── POST /api/auth/verify-code ─────
   Шаг 2: проверяет код, создаёт пользователя, отправляет приветственное письмо */
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email и код обязательны' });
    }

    const pending = pendingCodes.get(email);
    if (!pending) {
      return res.status(400).json({ error: 'Код не найден. Запросите новый' });
    }
    if (Date.now() > pending.expiresAt) {
      pendingCodes.delete(email);
      return res.status(400).json({ error: 'Код истёк. Запросите новый' });
    }
    if (pending.code !== code.trim()) {
      return res.status(400).json({ error: 'Неверный код' });
    }

    // Код верный — создаём пользователя
    const passwordHash = await bcrypt.hash(pending.password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, role, created_at`,
      [pending.name, email, passwordHash, pending.phone],
    );

    const user = rows[0];
    const token = signToken(user);
    pendingCodes.delete(email);

    // Приветственное письмо (отправляем асинхронно, не блокируем ответ)
    sendMail({
      to: email,
      subject: 'Добро пожаловать в AutoSite!',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;border:1px solid #eee;border-radius:12px;">
          <h2 style="color:#1a1a2e;margin-top:0;">Добро пожаловать, ${user.name}!</h2>
          <p>Вы успешно зарегистрировались на <strong>AutoSite</strong>.</p>
          <p>Теперь вам доступен личный кабинет, история заказов и многое другое.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
          <p style="color:#888;font-size:13px;">Это автоматическое письмо. Если вы не регистрировались — свяжитесь с поддержкой.</p>
        </div>
      `,
    }).catch(err => console.error('Welcome mail error:', err));

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Verify-code error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/* ───── POST /api/auth/register (legacy, без верификации) ───── */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }

    // проверка дубликата
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, role, created_at`,
      [name, email, passwordHash, phone || null],
    );

    const user = rows[0];
    const token = signToken(user);

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/* ───── POST /api/auth/login ───── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = signToken(user);

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/* ───── GET /api/auth/me ───── */
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, surname, patronymic, email, phone, address, birth_date, gender, role, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;
