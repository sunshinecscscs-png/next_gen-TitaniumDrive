/**
 * Telegram Bot для автопарсера
 * 
 * Админ кидает ссылку → бот парсит → создаёт объявление.
 * 
 * ENV variables:
 *   TELEGRAM_BOT_TOKEN  — токен от @BotFather
 *   TELEGRAM_ADMIN_IDS  — список Telegram user IDs через запятую (только они могут парсить)
 *   API_BASE_URL        — URL вашего сервера (по умолчанию http://localhost:4000)
 *   ADMIN_JWT_TOKEN     — JWT токен админа для API-вызовов
 */

import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import parseMobileDe from '../parser/mobilede.js';
import pool from '../db/pool.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Список разрешённых Telegram user ID
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map(id => Number(id.trim()))
  .filter(Boolean);

/* ── Middleware: проверка доступа ── */
function isAdmin(ctx) {
  if (ADMIN_IDS.length === 0) return true; // Если не настроено — пускаем всех
  return ADMIN_IDS.includes(ctx.from?.id);
}

/* ── /start ── */
bot.start((ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ У вас нет доступа к этому боту.');
  }

  ctx.reply(
    `🚗 *AutoSite Parser Bot*\n\n` +
    `Отправь мне ссылку на объявление с mobile\\.de и я создам объявление на сайте\\.\n\n` +
    `*Поддерживаемые сайты:*\n` +
    `• mobile\\.de\n\n` +
    `*Команды:*\n` +
    `/start — Приветствие\n` +
    `/help — Помощь\n` +
    `/status — Статус бота\n` +
    `/stats — Статистика объявлений`,
    { parse_mode: 'MarkdownV2' }
  );
});

/* ── /help ── */
bot.help((ctx) => {
  if (!isAdmin(ctx)) return;
  ctx.reply(
    '📖 Как пользоваться:\n\n' +
    '1. Скопируй ссылку на объявление с mobile.de\n' +
    '2. Отправь её в этот чат\n' +
    '3. Бот распарсит данные и скачает фото\n' +
    '4. Объявление появится на сайте (сначала скрыто)\n' +
    '5. Зайди в админку и опубликуй\n\n' +
    '💡 Можно кидать несколько ссылок — каждая обработается отдельно.'
  );
});

/* ── /status ── */
bot.command('status', (ctx) => {
  if (!isAdmin(ctx)) return;
  ctx.reply(`✅ Бот работает\n🆔 Ваш ID: ${ctx.from.id}`);
});

/* ── /stats ── */
bot.command('stats', async (ctx) => {
  if (!isAdmin(ctx)) return;
  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_published = true)::int AS published,
        COUNT(*) FILTER (WHERE is_published = false)::int AS hidden,
        COUNT(*) FILTER (WHERE source_url IS NOT NULL)::int AS parsed
      FROM cars
    `);
    const s = rows[0];
    ctx.reply(
      `📊 Статистика:\n\n` +
      `Всего объявлений: ${s.total}\n` +
      `Опубликовано: ${s.published}\n` +
      `Скрыто: ${s.hidden}\n` +
      `Создано парсером: ${s.parsed}`
    );
  } catch (err) {
    ctx.reply(`❌ Ошибка получения статистики: ${err.message}`);
  }
});

/* ── Обработка ссылок ── */
bot.on('text', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ У вас нет доступа.');
  }

  const text = ctx.message.text.trim();

  // Извлекаем все URL из сообщения
  const urlRegex = /https?:\/\/[^\s]+mobile\.de[^\s]+/gi;
  const urls = text.match(urlRegex);

  if (!urls || urls.length === 0) {
    // Может быть просто текст — игнорируем
    if (text.startsWith('/')) return; // Ignore unknown commands
    return ctx.reply(
      '🔗 Отправь ссылку с mobile.de\n\n' +
      'Пример: https://www.mobile.de/ru/.../подробности.html?id=443293823...'
    );
  }

  for (const url of urls) {
    await processUrl(ctx, url);
  }
});

/**
 * Обрабатывает одну ссылку
 */
async function processUrl(ctx, url) {
  const statusMsg = await ctx.reply(`⏳ Парсинг...\n🔗 ${truncateUrl(url)}`);

  try {
    let carData;

    if (url.includes('mobile.de')) {
      carData = await parseMobileDe(url);
    } else {
      await ctx.telegram.editMessageText(
        ctx.chat.id, statusMsg.message_id, null,
        `❌ Неподдерживаемый сайт.\nПоддерживаются: mobile.de`
      );
      return;
    }

    // Обновляем статус
    await ctx.telegram.editMessageText(
      ctx.chat.id, statusMsg.message_id, null,
      `⏳ Сохранение в базу данных...\n🚗 ${carData.name}`
    );

    // Сохраняем в БД (is_published = false, price/mileage/body_type/condition/description — пустые)
    const savedCar = await saveCarToDb(carData);

    // Формируем отчёт
    const report = formatReport(savedCar, carData);

    // Ссылка на редактирование в админке
    const siteUrl = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const editLink = `${siteUrl}/?admin=True&edit_car=${savedCar.id}`;

    // Удаляем промежуточное сообщение
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

    // Текст сообщения с ссылкой
    const messageText = report +
      `\n\n� <a href="${editLink}">Редактировать в админке</a>`;

    // Отправляем фото + описание
    if (carData.image) {
      try {
        const imgUrl = carData.image.startsWith('http')
          ? carData.image
          : `${process.env.API_BASE_URL || 'http://localhost:4000'}${carData.image}`;

        await ctx.replyWithPhoto(
          { url: imgUrl },
          { caption: messageText, parse_mode: 'HTML' }
        );
      } catch {
        await ctx.reply(messageText, { parse_mode: 'HTML' });
      }
    } else {
      await ctx.reply(messageText, { parse_mode: 'HTML' });
    }

  } catch (err) {
    console.error('[Bot] Parse error:', err);
    await ctx.telegram.editMessageText(
      ctx.chat.id, statusMsg.message_id, null,
      `❌ Ошибка парсинга:\n${err.message}\n\n🔗 ${truncateUrl(url)}`
    ).catch(() => {});
  }
}

/* ═══════════════════ DB ═══════════════════ */

/**
 * Замена символов, которых нет в WIN1251, на ближайшие аналоги
 */
const WIN1251_REPLACE = {
  '\u00f6': 'o', '\u00d6': 'O', '\u00e4': 'a', '\u00c4': 'A', '\u00fc': 'u', '\u00dc': 'U', '\u00df': 'ss',
  '\u00e9': 'e', '\u00c9': 'E', '\u00e8': 'e', '\u00c8': 'E', '\u00ea': 'e', '\u00ca': 'E', '\u00eb': 'e',
  '\u00e0': 'a', '\u00c0': 'A', '\u00e2': 'a', '\u00c2': 'A', '\u00f4': 'o', '\u00d4': 'O', '\u00f9': 'u',
  '\u00d9': 'U', '\u00fb': 'u', '\u00db': 'U', '\u00ee': 'i', '\u00ce': 'I', '\u00ef': 'i', '\u00cf': 'I',
  '\u00f1': 'n', '\u00d1': 'N', '\u00e7': 'c', '\u00c7': 'C', '\u00f8': 'o', '\u00d8': 'O', '\u00e5': 'a',
  '\u00c5': 'A', '\u00e6': 'ae', '\u00c6': 'AE', '\u0153': 'oe', '\u0152': 'OE',
  '\u2013': '-', '\u2014': '-', '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2026': '...',
  '\u2022': '*', '\u2122': 'TM', '\u00a9': '(c)', '\u00ae': '(R)', '\u00d7': 'x',
  '\u2009': ' ', '\u00a0': ' ', '\u200b': '', '\u200e': '', '\u200f': '',
};

function sanitizeWin1251(str) {
  if (!str || typeof str !== 'string') return str;
  let result = str;
  for (const [char, replacement] of Object.entries(WIN1251_REPLACE)) {
    result = result.replaceAll(char, replacement);
  }
  // Убираем оставшиеся символы вне WIN1251 (ASCII + кириллица)
  result = result.replace(/[^\x00-\x7F\u0400-\u04FF\u2116€₽№°²³±]/g, '');
  return result;
}

function sanitizeData(data) {
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      clean[key] = sanitizeWin1251(value);
    } else if (Array.isArray(value)) {
      clean[key] = value.map(v => typeof v === 'string' ? sanitizeWin1251(v) : v);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

async function saveCarToDb(rawData) {
  const data = sanitizeData(rawData);
  const imagesJson = JSON.stringify(Array.isArray(data.images) ? data.images.slice(0, 30) : []);
  const featuresJson = sanitizeWin1251(JSON.stringify(Array.isArray(data.features) ? data.features : []));

  const { rows } = await pool.query(
    `INSERT INTO cars (
      name, spec, price, old_price, condition, brand, model, year,
      body_type, fuel, drive, transmission, engine, power,
      consumption, acceleration, trunk, color_name, color_hex,
      city, dealer, image, image2, images, description, is_published, mileage,
      seats, doors, owners, weight, cylinders, fuel_tank,
      eco_class, co2_emissions, features, origin, interior, source_url, first_registration
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,
      $28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40
    ) RETURNING *`,
    [
      data.name, data.spec || null, 0, data.old_price || null,
      null, data.brand || null, data.model || null, data.year || null,
      null, data.fuel || null, data.drive || null, data.transmission || null,
      data.engine || null, data.power || null, data.consumption || null, data.acceleration || null,
      data.trunk || null, null, '#cccccc',
      data.city || null, data.dealer || null, data.image || null, data.image2 || null,
      imagesJson, null, data.is_published || false, 0,
      data.seats || null, data.doors || null, null,
      data.weight || null, data.cylinders || null, data.fuel_tank || null,
      data.eco_class || null, data.co2_emissions || null, featuresJson,
      null, data.interior || null, data.source_url || null, null,
    ]
  );

  return rows[0];
}

/* ═══════════════════ Formatting ═══════════════════ */

function formatReport(car, parsed) {
  const lines = [
    `<b>🚗 ${car.name || 'Без названия'}</b>`,
    '',
  ];

  // Спарсенные данные
  if (car.year) lines.push(`📅 Год: ${car.year}`);
  if (car.fuel) lines.push(`⛽ Топливо: ${car.fuel}`);
  if (car.transmission) lines.push(`⚙️ КПП: ${car.transmission}`);
  if (car.power) lines.push(`💪 Мощность: ${car.power}`);
  if (car.engine) lines.push(`🔧 Двигатель: ${car.engine}`);
  if (car.drive) lines.push(`🔄 Привод: ${car.drive}`);

  const imgCount = parsed.images?.length || 0;
  const featCount = parsed.features?.length || 0;
  lines.push('');
  lines.push(`📸 Фото: ${imgCount}`);
  if (featCount > 0) lines.push(`✅ Опций: ${featCount}`);

  lines.push('');
  lines.push(`🆔 ID: ${car.id}`);
  lines.push(`👁 Статус: <b>${car.is_published ? 'Опубликовано' : 'Скрыто'}</b>`);

  // Поля для ручного заполнения
  lines.push('');
  lines.push(`⚠️ <b>Заполните вручную:</b>`);
  lines.push(`  • 💰 Цена`);
  lines.push(`  • 🛣 Пробег`);
  lines.push(`  • 📋 Состояние`);
  lines.push(`  • 🏎 Тип кузова`);
  lines.push(`  • 🎨 Цвет`);
  lines.push(`  • 📝 Описание`);

  return lines.join('\n');
}

function formatPrice(price) {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function truncateUrl(url, max = 60) {
  if (url.length <= max) return url;
  return url.slice(0, max) + '...';
}

/* ═══════════════════ Launch ═══════════════════ */

export function startBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN не задан — Telegram бот не запущен');
    return null;
  }

  bot.launch()
    .then(() => console.log('🤖 Telegram бот запущен'))
    .catch((err) => console.error('❌ Ошибка запуска бота:', err.message));

  // Graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}

export default bot;
