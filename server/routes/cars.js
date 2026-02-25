import { Router } from 'express';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';

const router = Router();

/* ── Middleware: только admin ── */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

/* ═══════════════════ PUBLIC ═══════════════════ */

/* ───── GET /api/cars — публичный список (опубликованные) ───── */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let idx = 1;

    // Только опубликованные для публичного API
    conditions.push('is_published = true');

    // Helper: support comma-separated multi-value filters via ANY(array)
    const addMulti = (queryVal, col, ilike = false) => {
      if (!queryVal) return;
      const vals = queryVal.split(',').map(v => v.trim()).filter(Boolean);
      if (!vals.length) return;
      if (ilike) {
        // Case-insensitive matching
        if (vals.length === 1) {
          params.push(vals[0]);
          conditions.push(`${col} ILIKE $${idx++}`);
        } else {
          const ors = vals.map(v => { params.push(v); return `${col} ILIKE $${idx++}`; });
          conditions.push(`(${ors.join(' OR ')})`);
        }
      } else {
        if (vals.length === 1) {
          params.push(vals[0]);
          conditions.push(`TRIM(${col}) = TRIM($${idx++})`);
        } else {
          // Use TRIM + ANY via subquery for multi-value exact match
          params.push(vals);
          conditions.push(`TRIM(${col}) = ANY(SELECT TRIM(unnest($${idx++}::text[])))`);
        }
      }
    };

    addMulti(req.query.brand, 'brand');
    addMulti(req.query.body_type, 'body_type');
    addMulti(req.query.fuel, 'fuel');
    addMulti(req.query.drive, 'drive');
    addMulti(req.query.transmission, 'transmission', true);
    addMulti(req.query.condition, 'condition');
    addMulti(req.query.model, 'model');
    if (req.query.discount === 'yes') {
      conditions.push('old_price IS NOT NULL AND old_price > 0');
    } else if (req.query.discount === 'no') {
      conditions.push('(old_price IS NULL OR old_price = 0)');
    }
    if (req.query.price_min) {
      params.push(Number(req.query.price_min));
      conditions.push(`(price IS NULL OR price >= $${idx++})`);
    }
    if (req.query.price_max) {
      params.push(Number(req.query.price_max));
      conditions.push(`(price IS NULL OR price <= $${idx++})`);
    }
    if (req.query.year_min) {
      params.push(Number(req.query.year_min));
      conditions.push(`(year IS NULL OR year >= $${idx++})`);
    }
    if (req.query.year_max) {
      params.push(Number(req.query.year_max));
      conditions.push(`(year IS NULL OR year <= $${idx++})`);
    }
    if (req.query.mileage_min) {
      params.push(Number(req.query.mileage_min));
      conditions.push(`(mileage IS NULL OR mileage >= $${idx++})`);
    }
    if (req.query.mileage_max) {
      params.push(Number(req.query.mileage_max));
      conditions.push(`(mileage IS NULL OR mileage <= $${idx++})`);
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      conditions.push(`(name ILIKE $${idx++} OR brand ILIKE $${idx - 1} OR model ILIKE $${idx - 1})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sort
    const sortMap = {
      'price_asc': 'price ASC',
      'price_desc': 'price DESC',
      'date_desc': 'created_at DESC',
      'date_asc': 'created_at ASC',
      'year_desc': 'year DESC NULLS LAST',
      'name_asc': 'name ASC',
    };
    const orderBy = sortMap[req.query.sort] || 'created_at DESC';

    const countQuery = `SELECT COUNT(*) AS count FROM cars ${where}`;
    const dataQuery = `SELECT * FROM cars ${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, params),
    ]);

    res.json({
      cars: dataRes.rows,
      total: Number(countRes.rows[0].count),
      page,
      pages: Math.ceil(Number(countRes.rows[0].count) / limit),
    });
  } catch (err) {
    console.error('Cars list error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── GET /api/cars/stats/counts — фасеты для всех фильтров ───── */
router.get('/stats/counts', async (req, res) => {
  try {
    const pub = "is_published = true";
    const nn = (col) => `${col} IS NOT NULL AND ${col} != ''`;

    const facetQuery = (col) =>
      `SELECT ${col} AS name, COUNT(*)::int AS count FROM cars WHERE ${pub} AND ${nn(col)} GROUP BY ${col} ORDER BY count DESC`;

    const [
      bodyRes, brandRes, conditionRes, modelRes,
      transmissionRes, fuelRes, driveRes,
      rangesRes, totalRes,
    ] = await Promise.all([
      pool.query(facetQuery('body_type')),
      pool.query(facetQuery('brand')),
      pool.query(facetQuery('condition')),
      pool.query(`SELECT CONCAT(brand, ' ', model, ' ', year) AS name, model AS value, COUNT(*)::int AS count
                  FROM cars WHERE ${pub} AND brand IS NOT NULL AND model IS NOT NULL AND model != ''
                  GROUP BY brand, model, year ORDER BY count DESC`),
      pool.query(facetQuery('transmission')),
      pool.query(facetQuery('fuel')),
      pool.query(facetQuery('drive')),
      pool.query(`SELECT
        MIN(price)::bigint AS price_min, MAX(price)::bigint AS price_max,
        MIN(year) AS year_min, MAX(year) AS year_max,
        MIN(mileage)::int AS mileage_min, MAX(mileage)::int AS mileage_max
        FROM cars WHERE ${pub}`),
      pool.query(`SELECT COUNT(*)::int AS total FROM cars WHERE ${pub}`),
    ]);

    const r = rangesRes.rows[0] || {};

    // Condition with "Все" total
    const total = totalRes.rows[0]?.total || 0;
    const conditionList = [{ name: 'Все', count: total }, ...conditionRes.rows];

    // Discount facets
    const discountQ = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE old_price IS NOT NULL AND old_price > 0)::int AS with_discount,
        COUNT(*) FILTER (WHERE old_price IS NULL OR old_price = 0)::int AS without_discount
       FROM cars WHERE ${pub}`
    );
    const dRow = discountQ.rows[0] || {};
    const discountList = [
      { name: 'Все', count: total },
      { name: 'Со скидкой', count: dRow.with_discount || 0 },
      { name: 'Без скидки', count: dRow.without_discount || 0 },
    ];

    res.json({
      bodyTypes: bodyRes.rows,
      brands: brandRes.rows,
      conditions: conditionList,
      models: modelRes.rows,
      transmissions: transmissionRes.rows,
      fuels: fuelRes.rows,
      drives: driveRes.rows,
      discounts: discountList,
      priceMin: Number(r.price_min) || 0,
      priceMax: Number(r.price_max) || 0,
      yearMin: r.year_min || new Date().getFullYear(),
      yearMax: r.year_max || new Date().getFullYear(),
      mileageMin: r.mileage_min || 0,
      mileageMax: r.mileage_max || 0,
      total,
    });
  } catch (err) {
    console.error('Stats counts error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── GET /api/cars/:id — публичная карточка ───── */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cars WHERE id = $1 AND is_published = true', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Автомобиль не найден' });
    res.json({ car: rows[0] });
  } catch (err) {
    console.error('Car detail error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ═══════════════════ ADMIN ═══════════════════ */

/* ───── GET /api/cars/admin/list — все авто (включая неопубликованные) ───── */
router.get('/admin/list', auth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let where = '';
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE name ILIKE $1 OR brand ILIKE $1 OR model ILIKE $1`;
    }

    const countQuery = `SELECT COUNT(*) AS count FROM cars ${where}`;
    const dataQuery = `SELECT * FROM cars ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, params),
    ]);

    res.json({
      cars: dataRes.rows,
      total: Number(countRes.rows[0].count),
      page,
      pages: Math.ceil(Number(countRes.rows[0].count) / limit),
    });
  } catch (err) {
    console.error('Admin cars list error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── POST /api/cars/admin/create ───── */
router.post('/admin/create', auth, requireAdmin, async (req, res) => {
  try {
    const {
      name: rawName, spec, price, old_price, condition, brand, model, year,
      body_type, fuel, drive, transmission, engine, power,
      consumption, acceleration, trunk, color_name, color_hex,
      city, dealer, image, image2, images, description, is_published, mileage,
    } = req.body;

    // Auto-generate name from brand + model + year if not provided
    const name = rawName || [brand, model, year].filter(Boolean).join(' ') || null;

    if (!name) return res.status(400).json({ error: 'Укажите марку или название' });
    if (!price && price !== 0) return res.status(400).json({ error: 'Цена обязательна' });

    const imagesJson = JSON.stringify(Array.isArray(images) ? images.slice(0, 30) : []);

    const { rows } = await pool.query(
      `INSERT INTO cars (
        name, spec, price, old_price, condition, brand, model, year,
        body_type, fuel, drive, transmission, engine, power,
        consumption, acceleration, trunk, color_name, color_hex,
        city, dealer, image, image2, images, description, is_published, mileage
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
      ) RETURNING *`,
      [
        name, spec || null, Number(price), old_price ? Number(old_price) : null,
        condition || 'Новое авто', brand || null, model || null, year ? Number(year) : null,
        body_type || null, fuel || null, drive || null, transmission || null,
        engine || null, power || null, consumption || null, acceleration || null,
        trunk || null, color_name || null, color_hex || '#cccccc',
        city || null, dealer || null, image || null, image2 || null,
        imagesJson, description || null, is_published !== false, mileage ? Number(mileage) : 0,
      ],
    );

    res.status(201).json({ car: rows[0] });
  } catch (err) {
    console.error('Create car error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── PUT /api/cars/admin/:id ───── */
router.put('/admin/:id', auth, requireAdmin, async (req, res) => {
  try {
    // Auto-generate name from brand + model + year
    if (req.body.brand !== undefined || req.body.model !== undefined || req.body.year !== undefined) {
      const autoName = [req.body.brand, req.body.model, req.body.year].filter(Boolean).join(' ');
      if (autoName) req.body.name = autoName;
    }

    const fields = [
      'name', 'spec', 'price', 'old_price', 'condition', 'brand', 'model', 'year',
      'body_type', 'fuel', 'drive', 'transmission', 'engine', 'power',
      'consumption', 'acceleration', 'trunk', 'color_name', 'color_hex',
      'city', 'dealer', 'image', 'image2', 'images', 'description', 'is_published', 'mileage',
    ];

    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        let val = req.body[field];
        if (['price', 'old_price', 'year', 'mileage'].includes(field) && val !== null) val = Number(val);
        if (field === 'images') val = JSON.stringify(Array.isArray(val) ? val.slice(0, 30) : []);
        params.push(val);
      }
    }

    if (!setClauses.length) return res.status(400).json({ error: 'Нечего обновлять' });

    setClauses.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const query = `UPDATE cars SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const { rows } = await pool.query(query, params);

    if (!rows.length) return res.status(404).json({ error: 'Автомобиль не найден' });
    res.json({ car: rows[0] });
  } catch (err) {
    console.error('Update car error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── DELETE /api/cars/admin/:id ───── */
router.delete('/admin/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM cars WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Автомобиль не найден' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete car error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ───── PATCH /api/cars/admin/:id/toggle ─────
   Быстрое переключение опубликовано / скрыто */
router.patch('/admin/:id/toggle', auth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE cars SET is_published = NOT is_published, updated_at = NOW() WHERE id = $1 RETURNING id, name, is_published',
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Автомобиль не найден' });
    res.json({ car: rows[0] });
  } catch (err) {
    console.error('Toggle car error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
