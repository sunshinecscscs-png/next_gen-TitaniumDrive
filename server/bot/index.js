/**
 * Telegram Bot для автопарсера — МУЛЬТИ-САЙТ
 *
 * Админ кидает ссылку → бот парсит → админ выбирает сайты → объявление создаётся.
 *
 * Конфигурация сайтов — в bot/sites.json
 *
 * ENV variables:
 *   TELEGRAM_BOT_TOKEN  — токен от @BotFather
 *   TELEGRAM_ADMIN_IDS  — список Telegram user IDs через запятую
 *   API_BASE_URL        — URL текущего сервера (по умолчанию http://localhost:4000)
 */

import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import https from 'https';
import parseMobileDe from '../parser/mobilede.js';
import { loadSites, getSites, getPool, reloadSites } from './multipool.js';

dotenv.config();

/* ── Загружаем конфигурацию сайтов ── */
loadSites();

// Принудительно IPv4 — на сервере IPv6 недоступен (no route to host)
const ipv4Agent = new https.Agent({ family: 4 });

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: { agent: ipv4Agent },
});

// Список разрешённых Telegram user ID
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map(id => Number(id.trim()))
  .filter(Boolean);

/* ── Сессии парсинга (для мультивыбора сайтов) ── */
const parseSessions = new Map(); // sessionId → { carData, selected, url, createdAt }
let nextSessionId = 1;

// Очистка старых сессий (>30 мин)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of parseSessions) {
    if (now - session.createdAt > 30 * 60 * 1000) {
      parseSessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

/* ── Middleware: проверка доступа ── */
function isAdmin(ctx) {
  if (ADMIN_IDS.length === 0) return true;
  return ADMIN_IDS.includes(ctx.from?.id);
}

/* ═══════════════════ Команды ═══════════════════ */

/* ── /start ── */
bot.start((ctx) => {
  const sites = getSites();
  const sitesList = sites.length
    ? sites.map(s => `  ${s.emoji} ${s.name}`).join('\n')
    : '  ⚠️ Не настроены (отредактируйте sites.json)';

  ctx.reply(
    `🚗 <b>AutoSite Parser Bot</b> (мульти-сайт)\n\n` +
    `Отправь ссылку на объявление с mobile.de — бот спарсит и предложит выбрать, на какие сайты сохранить.\n\n` +
    `<b>Подключённые сайты:</b>\n${sitesList}\n\n` +
    `<b>Команды:</b>\n` +
    `/start — Приветствие\n` +
    `/help — Помощь\n` +
    `/sites — Список сайтов\n` +
    `/stats — Статистика по сайтам\n` +
    `/reload — Перезагрузить sites.json\n` +
    `/status — Статус бота`,
    { parse_mode: 'HTML' }
  );
});

/* ── /help ── */
bot.help((ctx) => {
  ctx.reply(
    '📖 <b>Как пользоваться:</b>\n\n' +
    '1. Скопируй ссылку на объявление с mobile.de\n' +
    '2. Отправь её в этот чат\n' +
    '3. Бот распарсит данные и скачает фото\n' +
    '4. Выбери сайты для сохранения (✅/⬜)\n' +
    '5. Нажми «Сохранить» — объявление появится на выбранных сайтах\n' +
    '6. Зайди в админку каждого сайта и заполни цену, пробег и т.д.\n\n' +
    '💡 Можно кидать несколько ссылок — каждая обработается отдельно.\n' +
    '💡 Конфигурация сайтов — в файле <code>bot/sites.json</code>',
    { parse_mode: 'HTML' }
  );
});

/* ── /status ── */
bot.command('status', (ctx) => {
  const sites = getSites();
  ctx.reply(
    `✅ Бот работает\n` +
    `🆔 Ваш ID: ${ctx.from.id}\n` +
    `🌐 Сайтов подключено: ${sites.length}`
  );
});

/* ── /sites — список подключённых сайтов с проверкой доступности БД ── */
bot.command('sites', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const sites = getSites();

  if (sites.length === 0) {
    return ctx.reply(
      '⚠️ Нет подключённых сайтов.\n\n' +
      'Отредактируйте файл <code>bot/sites.json</code> и выполните /reload',
      { parse_mode: 'HTML' }
    );
  }

  let text = '🌐 <b>Подключённые сайты:</b>\n\n';
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    let dbStatus = '🔴';
    try {
      await getPool(i).query('SELECT 1');
      dbStatus = '🟢';
    } catch { /* БД недоступна */ }

    text += `${s.emoji} <b>${s.name}</b>\n`;
    text += `  БД: ${dbStatus} ${s.db.host}:${s.db.port}/${s.db.database}\n`;
    text += `  🌐 ${s.siteUrl}\n\n`;
  }

  ctx.reply(text, { parse_mode: 'HTML' });
});

/* ── /reload — перезагрузить sites.json ── */
bot.command('reload', (ctx) => {
  if (!isAdmin(ctx)) return;
  const sites = reloadSites();
  const list = sites.map(s => `  ${s.emoji} ${s.name}`).join('\n') || '  (пусто)';
  ctx.reply(`🔄 Конфигурация перезагружена!\n\nСайтов: ${sites.length}\n${list}`);
});

/* ── /stats — статистика по всем сайтам ── */
bot.command('stats', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const sites = getSites();

  if (sites.length === 0) {
    return ctx.reply('⚠️ Нет подключённых сайтов. Настройте sites.json');
  }

  let text = '📊 <b>Статистика по сайтам:</b>\n';

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    try {
      const { rows } = await getPool(i).query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_published = true)::int AS published,
          COUNT(*) FILTER (WHERE is_published = false)::int AS hidden,
          COUNT(*) FILTER (WHERE source_url IS NOT NULL)::int AS parsed
        FROM cars
      `);
      const s = rows[0];
      text += `\n${site.emoji} <b>${site.name}:</b>\n`;
      text += `  Всего: ${s.total} | Опубл.: ${s.published} | Скрыто: ${s.hidden} | Парсер: ${s.parsed}\n`;
    } catch (err) {
      text += `\n${site.emoji} <b>${site.name}:</b> ❌ ${err.message}\n`;
    }
  }

  ctx.reply(text, { parse_mode: 'HTML' });
});

/* ═══════════════════ Обработка ссылок ═══════════════════ */

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  const urlRegex = /https?:\/\/[^\s]+mobile\.de[^\s]+/gi;
  const urls = text.match(urlRegex);

  if (!urls || urls.length === 0) {
    if (text.startsWith('/')) return;
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
 * Парсит ссылку и показывает выбор сайтов (или сохраняет сразу, если сайт один)
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

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

    const sites = getSites();

    // ═══ 0 сайтов — ошибка ═══
    if (sites.length === 0) {
      return ctx.reply(
        `✅ Спарсено: <b>${carData.name}</b>\n\n` +
        `⚠️ Нет подключённых сайтов для сохранения!\n` +
        `Настройте <code>bot/sites.json</code> и выполните /reload`,
        { parse_mode: 'HTML' }
      );
    }

    // ═══ 1 сайт — сохраняем сразу, без UI выбора ═══
    if (sites.length === 1) {
      return await saveToSingleSite(ctx, carData, 0);
    }

    // ═══ 2+ сайтов — показываем мультивыбор ═══
    const sessionId = nextSessionId++;
    const session = {
      carData,
      selected: new Set(sites.map((_, i) => i)), // все выбраны по умолчанию
      url,
      createdAt: Date.now(),
    };
    parseSessions.set(sessionId, session);

    // Превью авто (фото + краткая информация)
    const previewText = buildPreview(carData);
    if (carData.image) {
      try {
        const imgUrl = resolveImageUrl(carData.image);
        await ctx.replyWithPhoto({ url: imgUrl }, { caption: previewText, parse_mode: 'HTML' });
      } catch {
        await ctx.reply(previewText, { parse_mode: 'HTML' });
      }
    } else {
      await ctx.reply(previewText, { parse_mode: 'HTML' });
    }

    // Клавиатура выбора сайтов
    await ctx.reply(
      buildSelectorText(session),
      { parse_mode: 'HTML', ...buildSelectorKeyboard(sessionId, session) }
    );

  } catch (err) {
    console.error('[Bot] Parse error:', err);
    await ctx.telegram.editMessageText(
      ctx.chat.id, statusMsg.message_id, null,
      `❌ Ошибка парсинга:\n${err.message}\n\n🔗 ${truncateUrl(url)}`
    ).catch(() => {});
  }
}

/* ═══════════════════ Мультивыбор: Action Handlers ═══════════════════ */

/* Переключение чекбокса сайта */
bot.action(/^st:(\d+):(\d+)$/, async (ctx) => {
  const sessionId = Number(ctx.match[1]);
  const siteIdx = Number(ctx.match[2]);
  const session = parseSessions.get(sessionId);
  if (!session) return ctx.answerCbQuery('⏰ Сессия истекла, отправьте ссылку заново');

  if (session.selected.has(siteIdx)) {
    session.selected.delete(siteIdx);
  } else {
    session.selected.add(siteIdx);
  }

  await ctx.answerCbQuery();
  return ctx.editMessageText(
    buildSelectorText(session),
    { parse_mode: 'HTML', ...buildSelectorKeyboard(sessionId, session) }
  );
});

/* Выбрать все / снять все */
bot.action(/^sa:(\d+)$/, async (ctx) => {
  const sessionId = Number(ctx.match[1]);
  const session = parseSessions.get(sessionId);
  if (!session) return ctx.answerCbQuery('⏰ Сессия истекла');

  const sites = getSites();
  if (session.selected.size === sites.length) {
    session.selected.clear();
  } else {
    for (let i = 0; i < sites.length; i++) session.selected.add(i);
  }

  await ctx.answerCbQuery();
  return ctx.editMessageText(
    buildSelectorText(session),
    { parse_mode: 'HTML', ...buildSelectorKeyboard(sessionId, session) }
  );
});

/* Подтвердить — сохранить на выбранные сайты */
bot.action(/^sc:(\d+)$/, async (ctx) => {
  const sessionId = Number(ctx.match[1]);
  const session = parseSessions.get(sessionId);
  if (!session) return ctx.answerCbQuery('⏰ Сессия истекла');

  if (session.selected.size === 0) {
    return ctx.answerCbQuery('⚠️ Выберите хотя бы один сайт!');
  }

  await ctx.answerCbQuery('💾 Сохранение...');
  await ctx.deleteMessage().catch(() => {});

  const sites = getSites();
  const localApiBase = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

  for (const siteIdx of session.selected) {
    const site = sites[siteIdx];
    const sitePool = getPool(siteIdx);

    try {
      // Локальный сайт → локальные пути к фото
      // Удалённый сайт → оригинальные CDN-ссылки (mobile.de)
      const isLocal = site.apiBaseUrl.replace(/\/+$/, '') === localApiBase;

      let carDataForSite = session.carData;
      if (!isLocal && session.carData.imageUrls?.length > 0) {
        carDataForSite = {
          ...session.carData,
          image: session.carData.imageUrls[0] || null,
          image2: session.carData.imageUrls[1] || null,
          images: session.carData.imageUrls.slice(0, 30),
        };
      }

      const savedCar = await saveCarToDb(carDataForSite, sitePool);
      const report = formatReport(savedCar, session.carData);
      const editLink = `${site.siteUrl.replace(/\/+$/, '')}/?admin=True&edit_car=${savedCar.id}`;

      const messageText =
        `${site.emoji} <b>${site.name}</b>\n\n` +
        report +
        `\n\n🔗 <a href="${editLink}">Редактировать в админке</a>`;

      if (session.carData.image) {
        try {
          const imgUrl = resolveImageUrl(session.carData.image);
          await ctx.replyWithPhoto({ url: imgUrl }, { caption: messageText, parse_mode: 'HTML' });
        } catch {
          await ctx.reply(messageText, { parse_mode: 'HTML' });
        }
      } else {
        await ctx.reply(messageText, { parse_mode: 'HTML' });
      }
    } catch (err) {
      console.error(`[Bot] Save error (${site.name}):`, err);
      await ctx.reply(
        `${site.emoji} <b>${site.name}</b> — ❌ Ошибка:\n<code>${err.message}</code>`,
        { parse_mode: 'HTML' }
      );
    }
  }

  parseSessions.delete(sessionId);
});

/* Отмена */
bot.action(/^sx:(\d+)$/, async (ctx) => {
  parseSessions.delete(Number(ctx.match[1]));
  await ctx.answerCbQuery('Отменено');
  return ctx.editMessageText('❌ Сохранение отменено.');
});

/* ═══════════════════ Сохранение на один сайт (без выбора) ═══════════════════ */

async function saveToSingleSite(ctx, carData, siteIdx) {
  const sites = getSites();
  const site = sites[siteIdx];
  const sitePool = getPool(siteIdx);

  const statusMsg = await ctx.reply(`⏳ Сохранение на ${site.emoji} ${site.name}...`);

  try {
    const savedCar = await saveCarToDb(carData, sitePool);
    const report = formatReport(savedCar, carData);
    const editLink = `${site.siteUrl.replace(/\/+$/, '')}/?admin=True&edit_car=${savedCar.id}`;

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

    const messageText =
      `${site.emoji} <b>${site.name}</b>\n\n` +
      report +
      `\n\n🔗 <a href="${editLink}">Редактировать в админке</a>`;

    if (carData.image) {
      try {
        const imgUrl = resolveImageUrl(carData.image);
        await ctx.replyWithPhoto({ url: imgUrl }, { caption: messageText, parse_mode: 'HTML' });
      } catch {
        await ctx.reply(messageText, { parse_mode: 'HTML' });
      }
    } else {
      await ctx.reply(messageText, { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error(`[Bot] Save error (${site.name}):`, err);
    await ctx.telegram.editMessageText(
      ctx.chat.id, statusMsg.message_id, null,
      `❌ Ошибка сохранения на ${site.name}:\n${err.message}`
    ).catch(() => {});
  }
}

/* ═══════════════════ UI Builders ═══════════════════ */

function buildPreview(carData) {
  const lines = [`<b>🚗 ${carData.name || 'Без названия'}</b>`, ''];
  if (carData.year) lines.push(`📅 Год: ${carData.year}`);
  if (carData.fuel) lines.push(`⛽ Топливо: ${carData.fuel}`);
  if (carData.transmission) lines.push(`⚙️ КПП: ${carData.transmission}`);
  if (carData.power) lines.push(`💪 Мощность: ${carData.power}`);
  if (carData.engine) lines.push(`🔧 Двигатель: ${carData.engine}`);
  if (carData.drive) lines.push(`🔄 Привод: ${carData.drive}`);
  const imgCount = carData.images?.length || 0;
  const featCount = carData.features?.length || 0;
  lines.push('');
  lines.push(`📸 Фото: ${imgCount}`);
  if (featCount > 0) lines.push(`✅ Опций: ${featCount}`);
  return lines.join('\n');
}

function buildSelectorText(session) {
  const sites = getSites();
  const carName = session.carData.name || 'Без названия';
  const selected = session.selected.size;
  return `📋 <b>Выберите сайты для сохранения:</b>\n\n` +
    `🚗 ${carName}\n` +
    `Выбрано: ${selected}/${sites.length}`;
}

function buildSelectorKeyboard(sessionId, session) {
  const sites = getSites();
  const buttons = [];

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const check = session.selected.has(i) ? '✅' : '⬜';
    buttons.push([
      Markup.button.callback(`${check} ${site.emoji} ${site.name}`, `st:${sessionId}:${i}`)
    ]);
  }

  const allSelected = session.selected.size === sites.length;
  buttons.push([
    Markup.button.callback(allSelected ? '🔘 Снять все' : '🔘 Выбрать все', `sa:${sessionId}`),
  ]);

  buttons.push([
    Markup.button.callback(`💾 Сохранить (${session.selected.size})`, `sc:${sessionId}`),
    Markup.button.callback('❌ Отмена', `sx:${sessionId}`),
  ]);

  return Markup.inlineKeyboard(buttons);
}

/* ═══════════════════ DB ═══════════════════ */

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

/**
 * Сохраняет авто в БД конкретного сайта
 * @param {object} rawData — данные авто
 * @param {pg.Pool} targetPool — пул БД целевого сайта
 */
async function saveCarToDb(rawData, targetPool) {
  const data = sanitizeData(rawData);
  const imagesJson = JSON.stringify(Array.isArray(data.images) ? data.images.slice(0, 30) : []);
  const featuresJson = sanitizeWin1251(JSON.stringify(Array.isArray(data.features) ? data.features : []));

  const { rows } = await targetPool.query(
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

/* ═══════════════════ Helpers ═══════════════════ */

function resolveImageUrl(src) {
  if (!src) return null;
  if (src.startsWith('http')) return src;
  const base = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
  return `${base}${src}`;
}

function formatReport(car, parsed) {
  const lines = [
    `<b>🚗 ${car.name || 'Без названия'}</b>`,
    '',
  ];

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

function truncateUrl(url, max = 60) {
  if (url.length <= max) return url;
  return url.slice(0, max) + '...';
}

/* ═══════════════════ Launch ═══════════════════ */

/* Глобальный обработчик ошибок Telegraf — ловим всё, чтобы бот не падал */
bot.catch((err, ctx) => {
  console.error(`[Bot] Ошибка в обработчике (${ctx?.updateType || 'unknown'}):`, err.message || err);
});

const BOT_RESTART_DELAY = 5000; // ms между попытками перезапуска

async function launchBotWithRetry(attempt = 1) {
  try {
    await bot.launch();
    console.log('🤖 Telegram бот запущен (мульти-сайт)');
  } catch (err) {
    console.error(`❌ Ошибка запуска бота (попытка ${attempt}):`, err.message);
    const delay = Math.min(BOT_RESTART_DELAY * attempt, 60000);
    console.log(`🔄 Повтор через ${delay / 1000}с...`);
    setTimeout(() => launchBotWithRetry(attempt + 1), delay);
  }
}

export function startBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN не задан — Telegram бот не запущен');
    return null;
  }

  launchBotWithRetry();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}

export default bot;
