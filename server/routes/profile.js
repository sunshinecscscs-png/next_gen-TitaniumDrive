import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 10;

const PROFILE_FIELDS = 'id, name, surname, patronymic, email, phone, address, birth_date, gender, role, created_at, updated_at';

/* ───── GET /api/profile ───── */
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${PROFILE_FIELDS} FROM users WHERE id = $1`,
      [req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Profile GET error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/* ───── PUT /api/profile ───── */
router.put('/', auth, async (req, res) => {
  try {
    const { name, surname, patronymic, phone, address, birth_date, gender } = req.body;

    const { rows } = await pool.query(
      `UPDATE users SET
        name       = COALESCE($1, name),
        surname    = COALESCE($2, surname),
        patronymic = COALESCE($3, patronymic),
        phone      = COALESCE($4, phone),
        address    = COALESCE($5, address),
        birth_date = COALESCE($6, birth_date),
        gender     = COALESCE($7, gender),
        updated_at = NOW()
      WHERE id = $8
      RETURNING ${PROFILE_FIELDS}`,
      [name, surname, patronymic, phone, address, birth_date || null, gender, req.user.id],
    );

    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Profile PUT error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/* ───── PUT /api/profile/password ───── */
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Текущий и новый пароль обязательны' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Новый пароль минимум 6 символов' });
    }

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Неверный текущий пароль' });

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

    res.json({ message: 'Пароль обновлён' });
  } catch (err) {
    console.error('Password PUT error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;
