import { Router } from 'express';
import pool from '../db/pool.js';
import auth from '../middleware/auth.js';
import { sendMail } from '../utils/mailer.js';

const router = Router();

/**
 * POST /api/orders
 * Place an order for a car (auth required)
 * Body: { car_id, phone?, name? }
 *
 * If the user provides a phone, it also updates their profile phone.
 */
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { car_id, phone, name } = req.body;

    if (!car_id) {
      return res.status(400).json({ error: 'Не указан автомобиль' });
    }

    /* Get user info */
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const user = userResult.rows[0];

    /* Use provided phone or user's profile phone */
    const orderPhone = phone?.trim() || user.phone;
    const orderName = name?.trim() || user.name;

    if (!orderPhone) {
      return res.status(400).json({ error: 'Укажите номер телефона' });
    }

    /* If user didn't have a phone, save it to their profile */
    if (phone?.trim() && !user.phone) {
      await pool.query('UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2', [phone.trim(), userId]);
    }

    /* Get car info */
    const carResult = await pool.query('SELECT * FROM cars WHERE id = $1', [car_id]);
    if (!carResult.rows.length) {
      return res.status(404).json({ error: 'Автомобиль не найден' });
    }
    const car = carResult.rows[0];

    /* Create order (callback_request with type='order') */
    const { rows } = await pool.query(
      `INSERT INTO callback_requests (type, name, phone, email, car_id, car_name, user_id, message)
       VALUES ('order', $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orderName, orderPhone, user.email, car_id, car.name, userId, `Заказ автомобиля ${car.name}`]
    );
    const order = rows[0];

    /* Create notification for user */
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1, 'order', $2, $3, $4)`,
      [
        userId,
        'Заказ оформлен',
        `Ваш заказ на ${car.name} принят. Менеджер свяжется с вами в ближайшее время.`,
        '/cabinet/requests',
      ]
    ).catch(err => console.error('Failed to create order notification:', err.message));

    /* Send confirmation email */
    const carImage = car.image || (car.images?.[0]) || '';
    const priceFormatted = Number(car.price).toLocaleString('ru-RU');
    const oldPriceHtml = car.old_price
      ? `<p style="color:#999;font-size:14px;text-decoration:line-through;margin:0 0 4px 0;">${Number(car.old_price).toLocaleString('ru-RU')} ₽</p>`
      : '';

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
        <div style="background:#1a1a2e;padding:24px 32px;">
          <h1 style="color:#fff;font-size:22px;margin:0;">TitaniumDrive</h1>
        </div>
        <div style="padding:28px 32px;">
          <h2 style="color:#222;font-size:20px;margin:0 0 8px;">Ваш заказ принят!</h2>
          <p style="color:#666;font-size:15px;line-height:1.5;margin:0 0 24px;">
            Спасибо за обращение, ${orderName}! Ваш заказ взят в обработку. Менеджер свяжется с вами в ближайшее время по номеру <strong>${orderPhone}</strong>.
          </p>

          <div style="background:#f8f9fc;border-radius:12px;overflow:hidden;border:1px solid #eee;">
            ${carImage ? `<img src="${carImage}" alt="${car.name}" style="width:100%;max-height:280px;object-fit:cover;display:block;" />` : ''}
            <div style="padding:20px;">
              <h3 style="margin:0 0 6px;color:#222;font-size:17px;">${car.name}</h3>
              ${car.spec ? `<p style="color:#888;font-size:13px;margin:0 0 12px;">${car.spec}</p>` : ''}
              ${oldPriceHtml}
              <p style="color:#1a1a2e;font-size:22px;font-weight:700;margin:0;">${priceFormatted} ₽</p>
              <div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;">
                ${car.year ? `<span style="background:#eef;padding:4px 10px;border-radius:6px;font-size:12px;color:#555;">${car.year} г.</span>` : ''}
                ${car.fuel ? `<span style="background:#eef;padding:4px 10px;border-radius:6px;font-size:12px;color:#555;">${car.fuel}</span>` : ''}
                ${car.transmission ? `<span style="background:#eef;padding:4px 10px;border-radius:6px;font-size:12px;color:#555;">${car.transmission}</span>` : ''}
                ${car.drive ? `<span style="background:#eef;padding:4px 10px;border-radius:6px;font-size:12px;color:#555;">${car.drive}</span>` : ''}
              </div>
            </div>
          </div>

          <p style="color:#aaa;font-size:13px;margin:24px 0 0;line-height:1.5;">
            Номер заказа: <strong>#${order.id}</strong><br/>
            Дата: ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style="background:#f8f9fc;padding:16px 32px;border-top:1px solid #eee;">
          <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">© TitaniumDrive — автомобили с гарантией</p>
        </div>
      </div>
    `;

    sendMail({
      to: user.email,
      subject: `Заказ #${order.id} — ${car.name} оформлен`,
      html: emailHtml,
    }).catch(err => console.error('Failed to send order email:', err.message));

    res.status(201).json({ order, car: { id: car.id, name: car.name, image: carImage, price: car.price } });
  } catch (err) {
    console.error('orders POST error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
