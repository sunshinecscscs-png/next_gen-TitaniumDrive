import { Router } from 'express';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';

const router = Router();

/* All favorites routes require authentication */
router.use(auth);

/* GET /api/favorites/ids — array of car IDs the user has liked */
router.get('/ids', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT car_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ ids: rows.map(r => r.car_id) });
  } catch (err) {
    console.error('favorites/ids error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* GET /api/favorites — full car objects the user has liked */
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.* FROM favorites f
       JOIN cars c ON c.id = f.car_id
       WHERE f.user_id = $1 AND c.is_published = true
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ cars: rows });
  } catch (err) {
    console.error('favorites error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* POST /api/favorites/:carId — toggle favorite (add / remove) */
router.post('/:carId', async (req, res) => {
  const carId = Number(req.params.carId);
  if (!carId) return res.status(400).json({ error: 'Некорректный id машины' });

  try {
    const exists = await pool.query(
      'SELECT 1 FROM favorites WHERE user_id = $1 AND car_id = $2',
      [req.user.id, carId]
    );

    if (exists.rows.length) {
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND car_id = $2',
        [req.user.id, carId]
      );
      return res.json({ favorited: false });
    }

    await pool.query(
      'INSERT INTO favorites (user_id, car_id) VALUES ($1, $2)',
      [req.user.id, carId]
    );
    res.json({ favorited: true });
  } catch (err) {
    console.error('favorites toggle error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
