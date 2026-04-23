/**
 * Telegram Catalog Bot — публичный каталог авто
 *
 * Пользователи могут просматривать авто, фильтровать по маркам,
 * кузовам, цене и т.д. через инлайн-кнопки.
 *
 * ENV:
 *   TELEGRAM_CATALOG_BOT_TOKEN — токен от @BotFather (отдельный бот)
 *   SITE_URL                   — URL сайта (для ссылок на авто)
 */

import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import pool from '../db/pool.js';
import { getTelegramAgent } from './proxy-agent.js';

dotenv.config();

const telegramAgent = getTelegramAgent();

const PAGE_SIZE = 1; // показываем по 1 авто за раз
const BRANDS_PER_PAGE = 8;

// Админ-юзер чат: adminId -> userId (с кем админ сейчас общается)
const adminChats = new Map();
// Обратная связь: userId -> adminId (какой админ общается с этим юзером)
const userChats = new Map();

function getAdminIds() {
  return (process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',').map(id => Number(id.trim())).filter(Boolean);
}

function isAdmin(userId) {
  return getAdminIds().includes(userId);
}

/* ══════════════════════ Helpers ══════════════════════ */

/**
 * Безопасная отправка текста: пробует editMessageText,
 * если не получается (фото-сообщение) — удаляет и отправляет новое.
 */
async function safeReply(ctx, text, opts, edit) {
  if (!edit) return ctx.reply(text, opts);
  try {
    return await ctx.editMessageText(text, opts);
  } catch {
    try { await ctx.deleteMessage(); } catch { /* ok */ }
    return ctx.reply(text, opts);
  }
}

function formatPrice(price) {
  if (!price) return '—';
  return Number(price).toLocaleString('ru-RU') + ' €';
}

function formatMileage(km) {
  if (!km) return '—';
  return Number(km).toLocaleString('ru-RU') + ' км';
}

function carCaption(car) {
  const lines = [];
  
  // Название: год + марка + модель
  const title = car.name || [car.year, car.brand, car.model].filter(Boolean).join(' ') || 'Без названия';
  lines.push(`<b>${title}</b>`);
  lines.push('под заказ из Европы с доставкой 2 месяца');
  lines.push('');
  
  // Характеристики
  const specs = [];
  if (car.engine || car.fuel) {
    const eng = [car.engine, car.fuel].filter(Boolean).join(', ');
    specs.push(`⛽ ${eng}`);
  }
  if (car.drive) specs.push(`⚙️ ${car.drive}`);
  if (car.transmission) specs.push(`🔧 ${car.transmission}`);
  if (car.mileage) specs.push(`🏁 ${formatMileage(car.mileage)}`);
  if (car.power) specs.push(`💪 ${car.power}`);
  if (car.body_type) specs.push(`🏎 ${car.body_type}`);
  if (car.color_name) specs.push(`🎨 ${car.color_name}`);
  if (specs.length) lines.push(specs.join('\n'));
  
  lines.push('');
  
  // Цена
  if (car.price) {
    lines.push(`💰 <b>Стоимость под ключ: ${formatPrice(car.price)}</b>`);
  }
  if (car.old_price && car.old_price > car.price) {
    const saving = Number(car.old_price) - Number(car.price);
    lines.push(`🤑 Выгода: ${formatPrice(saving)}`);
  }
  
  lines.push('');
  
  // Гарантии
  lines.push('✅ Гарантируем фиксированную цену под ключ');
  lines.push('✅ Действует оплата частями и кредитование');
  lines.push('✅ Авто полностью страхуется при доставке');
  
  return lines.join('\n');
}

function siteUrl() {
  return (process.env.SITE_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/* ══════════════════════ Bot Init ══════════════════════ */

let catalogBot = null;

export function startCatalogBot() {
  const token = process.env.TELEGRAM_CATALOG_BOT_TOKEN;
  if (!token) {
    console.log('⚠️  TELEGRAM_CATALOG_BOT_TOKEN не задан — каталог-бот не запущен');
    return null;
  }

  catalogBot = new Telegraf(token, { telegram: { agent: telegramAgent } });

  // Устанавливаем команды для кнопки Menu
  catalogBot.telegram.setMyCommands([
    { command: 'select_auto', description: '🚙 Перейти к подбору авто' },
    { command: 'call_manager', description: '👩 Связаться с менеджером' },
    { command: 'about_titanium', description: '❓ О компании TitaniumDrive' },
  ]);

  /* ── Типы кузовов (как на сайте) ── */
  const BODY_TYPES = [
    'Кроссовер', 'Хэтчбек', 'Седан', 'Лифтбек',
    'Минивэн', 'Фургон', 'Универсал', 'Пикап',
  ];

  function bodyTypeKeyboard() {
    return Markup.inlineKeyboard(
      BODY_TYPES.map(bt => [Markup.button.callback(`🏎 ${bt}`, `bodytype:${bt}`)])
    );
  }

  function budgetKeyboard(backTo) {
    const rows = [
      [Markup.button.callback('до 2 000 000 ₽', 'budget:0:2000000')],
      [Markup.button.callback('2 000 000 – 3 500 000 ₽', 'budget:2000000:3500000')],
      [Markup.button.callback('3 500 000 – 5 000 000 ₽', 'budget:3500000:5000000')],
      [Markup.button.callback('5 000 000 – 7 000 000 ₽', 'budget:5000000:7000000')],
      [Markup.button.callback('от 7 000 000 ₽', 'budget:7000000:0')],
    ];
    if (backTo) rows.push([Markup.button.callback('◀️ Назад', backTo)]);
    return Markup.inlineKeyboard(rows);
  }

  /* ── /start ── */
  catalogBot.start(async (ctx) => {
    const name = ctx.from?.first_name || ctx.from?.username || 'друг';
    // Скрываем reply-клавиатуру (если была)
    await ctx.reply('🚗', { reply_markup: { remove_keyboard: true } });
    try { await ctx.deleteMessage(); } catch { /* ok */ }

    return ctx.reply(
      `👋 Приветствуем, <b>${name}</b>!\n\n` +
      `Это чат-бот для подбора авто из Европы компании <b>TitaniumDrive</b> 🚗\n\n` +
      `Мы выполняем заказы на доставку авто «под ключ» с гарантией цены и выгодой до 37% ⚡\n\n` +
      `<b>${name}</b>, выберите тип кузова:`,
      {
        parse_mode: 'HTML',
        ...bodyTypeKeyboard(),
      }
    );
  });

  /* ── Выбор типа кузова → показать бюджеты ── */
  catalogBot.action(/^bodytype:(.+)$/, async (ctx) => {
    const bodyType = ctx.match[1];
    const name = ctx.from?.first_name || ctx.from?.username || 'друг';

    // Сохраняем выбранный кузов
    if (!catalogBot._userFilters) catalogBot._userFilters = new Map();
    const prev = catalogBot._userFilters.get(ctx.from.id) || {};
    catalogBot._userFilters.set(ctx.from.id, { ...prev, bodyType });

    return safeReply(ctx,
      `Тип кузова: <b>${bodyType}</b> ✅\n\n` +
      `<b>${name}</b>, в какой бюджет вам подобрать автомобиль?`,
      {
        parse_mode: 'HTML',
        ...budgetKeyboard('menu'),
      },
      true
    );
  });

  /* ── Выбор бюджета → промежуточный экран подтверждения ── */
  catalogBot.action(/^budget:(\d+):(\d+)$/, async (ctx) => {
    const min = Number(ctx.match[1]);
    const max = Number(ctx.match[2]);
    const name = ctx.from?.first_name || ctx.from?.username || 'друг';

    // Формируем читаемый диапазон
    const minStr = min ? Number(min).toLocaleString('ru-RU') : '0';
    const maxStr = max ? Number(max).toLocaleString('ru-RU') : '∞';
    const budgetLabel = max
      ? (min ? `${minStr} – ${maxStr} ₽` : `до ${maxStr} ₽`)
      : `от ${minStr} ₽`;

    // Сохраняем бюджет пользователя для кнопки «Получить подборку»
    if (!catalogBot._userFilters) catalogBot._userFilters = new Map();
    const prev = catalogBot._userFilters.get(ctx.from.id) || {};
    catalogBot._userFilters.set(ctx.from.id, { ...prev, min, max });

    // Также в _userBudgets для обратной совместимости
    if (!catalogBot._userBudgets) catalogBot._userBudgets = new Map();
    catalogBot._userBudgets.set(ctx.from.id, { min, max });

    const bodyLabel = prev.bodyType ? `\nТип кузова: <b>${prev.bodyType}</b>` : '';

    // 1) Подтверждение бюджета
    await safeReply(ctx,
      `Выбранный бюджет "<b>${budgetLabel}</b>" зафиксирован ✅${bodyLabel}\n\n` +
      `Для удобства клиентов у нас действует оплата в 5 этапов. ` +
      `Услуги компании Вы оплачиваете только тогда, когда авто уже будет доставлено в Россию.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Изменить параметры', 'menu')],
        ]),
      },
      true
    );

    // 2) Призыв нажать «Получить подборку»
    await ctx.reply(
      `<b>${name}</b>, нажмите на кнопку "Получить подборку", чтобы Чат Бот ` +
      `отправил Вам подходящие варианты под Ваш запрос в Telegram 👇\n\n` +
      `Или напишите номер телефона в формате <b>+7</b>`,
      { parse_mode: 'HTML' }
    );

    // 3) Смайлик отдельным сообщением + reply-клавиатура
    return ctx.reply('👇', {
      reply_markup: {
        keyboard: [[{ text: '📋 Получить подборку' }]],
        resize_keyboard: true,
      },
    });
  });

  /* ── Пагинация внутри бюджета ── */
  catalogBot.action(/^budgetpage:(\d+):(\d+):(\d+)$/, (ctx) => {
    const min = Number(ctx.match[1]);
    const max = Number(ctx.match[2]);
    const page = Number(ctx.match[3]);
    return sendCarList(ctx, { price_min: min || null, price_max: max || null }, page, true);
  });

  /* ── Пагинация комбо: кузов + бюджет ── */
  catalogBot.action(/^combo:(.+):(\d+):(\d+):(\d+)$/, (ctx) => {
    const bodyType = ctx.match[1];
    const min = Number(ctx.match[2]);
    const max = Number(ctx.match[3]);
    const page = Number(ctx.match[4]);
    return sendCarList(ctx, { body_type: bodyType, price_min: min || null, price_max: max || null }, page, true);
  });

  /* ── /select_auto — перейти к подбору (начинаем с кузова) ── */
  catalogBot.command('select_auto', (ctx) => {
    const name = ctx.from?.first_name || ctx.from?.username || 'друг';
    return ctx.reply(
      `<b>${name}</b>, выберите тип кузова:`,
      {
        parse_mode: 'HTML',
        ...bodyTypeKeyboard(),
      }
    );
  });

  /* ── /call_manager — связаться с менеджером ── */
  catalogBot.command('call_manager', async (ctx) => {
    const name = ctx.from?.first_name || ctx.from?.username || '';
    const username = ctx.from?.username ? `@${ctx.from.username}` : '';
    const userId = ctx.from?.id || '';

    await ctx.reply(
      `✅ <b>Запрос на связь с менеджером отправлен!</b>\n\n` +
      `Наш менеджер свяжется с вами в ближайшее время.\n` +
      `Или вы можете написать нам напрямую: @YulliaOfficial`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Меню', 'menu')],
        ]),
      }
    );

    // Уведомляем админов
    const adminIds = getAdminIds();
    for (const adminId of adminIds) {
      try {
        const userLink = username || `<a href="tg://user?id=${userId}">${name || 'Клиент'}</a>`;
        await catalogBot.telegram.sendMessage(adminId,
          `👩 <b>Запрос на менеджера!</b>\n\n` +
          `👤 ${userLink}\n` +
          `🆔 Telegram ID: ${userId}`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('✉️ Ответить клиенту', `chat:${userId}`)],
              [Markup.button.url('💬 Написать в личку', `tg://user?id=${userId}`)],
            ]),
          }
        );
      } catch { /* admin not available */ }
    }
  });

  /* ── /about_titanium — о компании ── */
  catalogBot.command('about_titanium', (ctx) => {
    return ctx.reply(
      `🏢 <b>О компании TitaniumDrive</b>\n\n` +
      `Мы благодарим вас за интерес к сотрудничеству! Наша компания уже много лет работает на рынке поставки автомобилей, выстроив прозрачную и юридически корректную схему работы. Мы сопровождаем клиента на каждом этапе — от выбора автомобиля до его постановки на учёт в России.\n\n` +
      `<b>Наши услуги:</b>\n\n` +
      `🔹 Выкуп автомобилей напрямую у собственников, без аукционов\n` +
      `🔹 Полная проверка состояния авто перед покупкой: техническая диагностика, эндоскопия двигателя, проверка ЛКП и трансмиссии\n` +
      `🔹 Таможенное оформление автомобилей на клиента с прозрачными расчётами\n` +
      `🔹 Организация доставки автомобилей до Москвы и в регионы РФ автовозами\n` +
      `🔹 Сопровождение сделки: заключение договора, проверка документов, оформление СБКТС\n` +
      `🔹 Возможность рассрочки`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.url('🌐 Перейти на сайт', siteUrl())],
          [Markup.button.callback('🚙 Подобрать авто', 'menu')],
        ]),
      }
    );
  });

  /* ── /help ── */
  catalogBot.help((ctx) => {
    ctx.reply(
      '📖 <b>Команды бота:</b>\n\n' +
      '/select_auto — 🚙 Перейти к подбору авто\n' +
      '/call_manager — 👩 Связаться с менеджером\n' +
      '/about_titanium — ❓ О компании\n',
      { parse_mode: 'HTML' }
    );
  });

  /* ── /catalog ── */
  catalogBot.command('catalog', (ctx) => sendCarList(ctx, {}, 0));

  /* ── /brands ── */
  catalogBot.command('brands', (ctx) => sendBrands(ctx, 0));

  /* ── /search ── */
  catalogBot.command('search', (ctx) => {
    const query = ctx.message.text.replace(/^\/search\s*/i, '').trim();
    if (!query) {
      return ctx.reply('🔍 Введите текст для поиска:\n<code>/search Toyota</code>', { parse_mode: 'HTML' });
    }
    return sendCarList(ctx, { search: query }, 0);
  });

  /* ══════════════════════ Callback Queries ══════════════════════ */

  /* Все авто — catalog:all:<page> */
  catalogBot.action(/^catalog:all:(\d+)$/, (ctx) => {
    const page = Number(ctx.match[1]);
    return sendCarList(ctx, {}, page, true);
  });

  /* По маркам — brands:<page> */
  catalogBot.action(/^brands:(\d+)$/, (ctx) => {
    const page = Number(ctx.match[1]);
    return sendBrands(ctx, page, true);
  });

  /* Список авто по марке — brand:<name>:<page> */
  catalogBot.action(/^brand:(.+):(\d+)$/, (ctx) => {
    const brand = ctx.match[1];
    const page = Number(ctx.match[2]);
    return sendCarList(ctx, { brand }, page, true);
  });

  /* По кузовам — bodies:<page> */
  catalogBot.action(/^bodies:(\d+)$/, (ctx) => {
    const page = Number(ctx.match[1]);
    return sendBodies(ctx, page, true);
  });

  /* Список авто по кузову — body:<name>:<page> */
  catalogBot.action(/^body:(.+):(\d+)$/, (ctx) => {
    const bodyType = ctx.match[1];
    const page = Number(ctx.match[2]);
    return sendCarList(ctx, { body_type: bodyType }, page, true);
  });

  /* Детали авто — car:<id> */
  catalogBot.action(/^car:(\d+)$/, (ctx) => {
    const carId = Number(ctx.match[1]);
    return sendCarDetail(ctx, carId, true);
  });

  /* Статистика — stats */
  catalogBot.action('stats', (ctx) => sendStats(ctx, true));

  /* Хочу заказать — order:<carId> */
  catalogBot.action(/^order:(\d+)$/, async (ctx) => {
    const carId = Number(ctx.match[1]);
    try {
      const { rows } = await pool.query('SELECT name, brand, model, year FROM cars WHERE id = $1', [carId]);
      const car = rows[0];
      const carName = car ? (car.name || `${car.brand} ${car.model} ${car.year}`) : `#${carId}`;
      const name = ctx.from?.first_name || ctx.from?.username || '';
      const username = ctx.from?.username ? `@${ctx.from.username}` : '';
      const userId = ctx.from?.id || '';

      // Отправляем пользователю подтверждение
      await ctx.answerCbQuery('✅ Заявка отправлена!');
      await safeReply(ctx,
        `✅ <b>Заявка на заказ отправлена!</b>\n\n` +
        `🚗 ${carName}\n\n` +
        `Наш менеджер свяжется с вами в ближайшее время.\n` +
        `Или вы можете позвонить нам: <b>+7 (968) 233-70-48</b>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🌐 Смотреть на сайте', `${siteUrl()}/car/${carId}`)],
            [Markup.button.callback('🏠 Меню', 'menu')],
          ]),
        },
        true
      );

      // Уведомляем админов (если настроены)
      const adminIds = getAdminIds();
      for (const adminId of adminIds) {
        try {
          const userLink = username || `<a href="tg://user?id=${userId}">${name || 'Клиент'}</a>`;
          await catalogBot.telegram.sendMessage(adminId,
            `🔔 <b>Новая заявка на заказ!</b>\n\n` +
            `🚗 ${carName} (ID: ${carId})\n` +
            `👤 ${userLink}\n` +
            `🆔 Telegram ID: ${userId}`,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('✉️ Ответить клиенту', `chat:${userId}`)],
                [Markup.button.url('💬 Написать в личку', `tg://user?id=${userId}`)],
                [Markup.button.url('🚗 Посмотреть авто', `${siteUrl()}/car/${carId}`)],
              ]),
            }
          );
        } catch { /* admin not available */ }
      }
    } catch (err) {
      console.error('[CatalogBot] order error:', err);
      ctx.answerCbQuery('❌ Ошибка, попробуйте позже');
    }
  });

  /* Назад в главное меню = выбор кузова */
  catalogBot.action('menu', (ctx) => {
    const name = ctx.from?.first_name || ctx.from?.username || 'друг';
    return safeReply(ctx,
      `Мы выполняем заказы на доставку авто «под ключ» с гарантией цены и выгодой до 37% ⚡\n\n` +
      `<b>${name}</b>, выберите тип кузова:`,
      {
        parse_mode: 'HTML',
        ...bodyTypeKeyboard(),
      },
      true
    );
  });

  /* Меню выбора бюджета */
  catalogBot.action('budgetmenu', (ctx) => {
    const name = ctx.from?.first_name || ctx.from?.username || 'друг';
    return safeReply(ctx,
      `<b>${name}</b>, в какой бюджет вам подобрать автомобиль?`,
      {
        parse_mode: 'HTML',
        ...budgetKeyboard('menu'),
      },
      true
    );
  });

  /* noop — для кнопки со страницами */
  catalogBot.action('noop', (ctx) => ctx.answerCbQuery());

  /* ══════════════ Админ-чат: начать диалог с клиентом ══════════════ */
  catalogBot.action(/^chat:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔ Нет доступа');
    const targetUserId = Number(ctx.match[1]);

    // Устанавливаем связь
    adminChats.set(ctx.from.id, targetUserId);
    userChats.set(targetUserId, ctx.from.id);

    await ctx.answerCbQuery('✅ Чат начат');
    return ctx.reply(
      `💬 <b>Вы начали диалог с клиентом</b> (ID: ${targetUserId})\n\n` +
      `Все ваши сообщения будут пересылаться клиенту.\n` +
      `Для завершения нажмите кнопку ниже.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔴 Завершить диалог', `endchat:${targetUserId}`)],
        ]),
      }
    );
  });

  /* Завершить диалог с клиентом */
  catalogBot.action(/^endchat:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔ Нет доступа');
    const targetUserId = Number(ctx.match[1]);

    adminChats.delete(ctx.from.id);
    userChats.delete(targetUserId);

    await ctx.answerCbQuery('Диалог завершён');
    return ctx.reply('✅ Диалог с клиентом завершён.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Меню', 'menu')],
      ]),
    });
  });

  /* Обработка произвольного текста */
  catalogBot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return; // unknown commands

    const senderId = ctx.from.id;

    // ═══ Админ пишет в диалоге — пересылаем клиенту ═══
    if (isAdmin(senderId) && adminChats.has(senderId)) {
      const targetUserId = adminChats.get(senderId);
      try {
        await catalogBot.telegram.sendMessage(targetUserId,
          `💬 <b>Менеджер TitaniumDrive:</b>\n\n${text}`,
          { parse_mode: 'HTML' }
        );
        // Подтверждение админу
        await ctx.reply('✅ Сообщение отправлено клиенту.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔴 Завершить диалог', `endchat:${targetUserId}`)],
          ]),
        });
      } catch (err) {
        await ctx.reply('❌ Не удалось отправить сообщение клиенту.');
      }
      return;
    }

    // ═══ Юзер пишет, а с ним общается админ — пересылаем админу ═══
    if (userChats.has(senderId)) {
      const adminId = userChats.get(senderId);
      const name = ctx.from?.first_name || ctx.from?.username || 'Клиент';
      try {
        await catalogBot.telegram.sendMessage(adminId,
          `💬 <b>Клиент ${name}</b> (ID: ${senderId}):\n\n${text}`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔴 Завершить диалог', `endchat:${senderId}`)],
            ]),
          }
        );
      } catch { /* ok */ }
      return;
    }

    // Кнопка «Получить подборку» из reply-клавиатуры
    if (text === '📋 Получить подборку') {
      const filters = catalogBot._userFilters?.get(ctx.from.id);
      if (filters && (filters.min != null || filters.max != null)) {
        const f = {};
        if (filters.min) f.price_min = filters.min;
        if (filters.max) f.price_max = filters.max;
        if (filters.bodyType) f.body_type = filters.bodyType;
        return sendCarList(ctx, f, 0);
      }
      // Если фильтры не выбраны — начинаем с кузова
      const name = ctx.from?.first_name || ctx.from?.username || 'друг';
      return ctx.reply(
        `<b>${name}</b>, сначала выберите тип кузова:`,
        {
          parse_mode: 'HTML',
          ...bodyTypeKeyboard(),
        }
      );
    }

    // Проверяем, похоже ли на номер телефона
    const phoneRegex = /^\+?\d[\d\s\-()]{6,}$/;
    if (phoneRegex.test(text)) {
      const name = ctx.from?.first_name || ctx.from?.username || '';
      const username = ctx.from?.username ? `@${ctx.from.username}` : '';
      const userId = ctx.from?.id || '';

      // Подтверждение пользователю
      await ctx.reply(
        `✅ Спасибо! Мы получили ваш номер: <b>${text}</b>\n\n` +
        `Наш менеджер свяжется с вами в ближайшее время.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🏠 Меню', 'menu')],
          ]),
        }
      );

      // Уведомляем админов
      const adminIds = getAdminIds();
      for (const adminId of adminIds) {
        try {
          const userLink = username || `<a href="tg://user?id=${userId}">${name || 'Клиент'}</a>`;
          await catalogBot.telegram.sendMessage(adminId,
            `📞 <b>Новый номер телефона!</b>\n\n` +
            `📱 ${text}\n` +
            `👤 ${userLink}\n` +
            `🆔 Telegram ID: ${userId}`,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('✉️ Ответить клиенту', `chat:${userId}`)],
                [Markup.button.url('💬 Написать в личку', `tg://user?id=${userId}`)],
              ]),
            }
          );
        } catch { /* admin not available */ }
      }
      return;
    }

    // Иначе — поиск по тексту
    return sendCarList(ctx, { search: text }, 0);
  });

  /* ══════════════ Пересылка медиа в чате (фото, видео, документы, голосовые, стикеры) ══════════════ */

  /**
   * Универсальный обработчик медиа-сообщений для чата админ↔клиент.
   * Пересылает через copyMessage — сохраняет оригинальный формат.
   */
  async function forwardMediaInChat(ctx) {
    const senderId = ctx.from.id;

    // Админ → клиент
    if (isAdmin(senderId) && adminChats.has(senderId)) {
      const targetUserId = adminChats.get(senderId);
      try {
        // Сначала подпись «от менеджера»
        await catalogBot.telegram.sendMessage(targetUserId,
          `💬 <b>Менеджер TitaniumDrive:</b>`,
          { parse_mode: 'HTML' }
        );
        // Пересылаем медиа как есть
        await catalogBot.telegram.copyMessage(targetUserId, ctx.chat.id, ctx.message.message_id);
        await ctx.reply('✅ Медиа отправлено клиенту.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔴 Завершить диалог', `endchat:${targetUserId}`)],
          ]),
        });
      } catch {
        await ctx.reply('❌ Не удалось отправить медиа клиенту.');
      }
      return;
    }

    // Клиент → админ
    if (userChats.has(senderId)) {
      const adminId = userChats.get(senderId);
      const name = ctx.from?.first_name || ctx.from?.username || 'Клиент';
      try {
        await catalogBot.telegram.sendMessage(adminId,
          `💬 <b>Клиент ${name}</b> (ID: ${senderId}) отправил медиа:`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔴 Завершить диалог', `endchat:${senderId}`)],
            ]),
          }
        );
        await catalogBot.telegram.copyMessage(adminId, ctx.chat.id, ctx.message.message_id);
      } catch { /* ok */ }
      return;
    }

    // Не в чате — игнорируем медиа
  }

  catalogBot.on('photo', forwardMediaInChat);
  catalogBot.on('video', forwardMediaInChat);
  catalogBot.on('document', forwardMediaInChat);
  catalogBot.on('voice', forwardMediaInChat);
  catalogBot.on('video_note', forwardMediaInChat);
  catalogBot.on('sticker', forwardMediaInChat);
  catalogBot.on('animation', forwardMediaInChat);
  catalogBot.on('audio', forwardMediaInChat);

  /* Глобальный обработчик ошибок — не даём боту упасть */
  catalogBot.catch((err, ctx) => {
    console.error(`[CatalogBot] Ошибка в обработчике (${ctx?.updateType || 'unknown'}):`, err.message || err);
  });

  /* ══════════════════════ Launch ══════════════════════ */

  const CATALOG_RESTART_DELAY = 5000;

  async function launchCatalogWithRetry(attempt = 1) {
    try {
      await catalogBot.launch();
      console.log('🛒 Telegram каталог-бот запущен');
    } catch (err) {
      console.error(`❌ Ошибка запуска каталог-бота (попытка ${attempt}):`, err.message);
      const delay = Math.min(CATALOG_RESTART_DELAY * attempt, 60000);
      console.log(`🔄 Повтор каталог-бота через ${delay / 1000}с...`);
      setTimeout(() => launchCatalogWithRetry(attempt + 1), delay);
    }
  }

  launchCatalogWithRetry();

  // Очистка _userFilters и _userBudgets (утечка памяти — чистим старые записи каждые 30 мин)
  setInterval(() => {
    if (catalogBot._userFilters?.size > 10000) {
      catalogBot._userFilters.clear();
      console.log('[CatalogBot] 🧹 Очистка _userFilters (>10K записей)');
    }
    if (catalogBot._userBudgets?.size > 10000) {
      catalogBot._userBudgets.clear();
      console.log('[CatalogBot] 🧹 Очистка _userBudgets (>10K записей)');
    }
  }, 30 * 60 * 1000);

  process.once('SIGINT', () => catalogBot.stop('SIGINT'));
  process.once('SIGTERM', () => catalogBot.stop('SIGTERM'));

  return catalogBot;
}

/* ══════════════════════ Data Functions ══════════════════════ */

/**
 * Отправить одну карточку авто с навигацией (листание)
 */
async function sendCarList(ctx, filters, page, edit = false) {
  try {
    const conditions = ['is_published = true'];
    const params = [];
    let idx = 1;

    if (filters.brand) {
      params.push(filters.brand);
      conditions.push(`TRIM(brand) = TRIM($${idx++})`);
    }
    if (filters.body_type) {
      params.push(filters.body_type);
      conditions.push(`TRIM(body_type) = TRIM($${idx++})`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(name ILIKE $${idx} OR brand ILIKE $${idx} OR model ILIKE $${idx})`);
      idx++;
    }
    if (filters.price_min) {
      params.push(filters.price_min);
      conditions.push(`price >= $${idx++}`);
    }
    if (filters.price_max) {
      params.push(filters.price_max);
      conditions.push(`price <= $${idx++}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = page * PAGE_SIZE;

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM cars ${where}`, params),
      pool.query(`SELECT * FROM cars ${where} ORDER BY created_at DESC LIMIT 1 OFFSET ${offset}`, params),
    ]);

    const total = countRes.rows[0].count;
    const car = dataRes.rows[0];

    if (total === 0) {
      const text = '😔 Авто не найдено в этом бюджете.';
      const kb = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Меню', 'menu')],
      ]);
      return safeReply(ctx, text, kb, edit);
    }

    // Формируем подпись карточки
    const caption = carCaption(car);
    const link = `${siteUrl()}/car/${car.id}`;

    // Навигация: ← | N/total | →
    const navButtons = [];
    if (page > 0) {
      navButtons.push(Markup.button.callback('⬅️', buildListCallback(filters, page - 1)));
    }
    navButtons.push(Markup.button.callback(`${page + 1}/${total}`, 'noop'));
    if (page + 1 < total) {
      navButtons.push(Markup.button.callback('➡️', buildListCallback(filters, page + 1)));
    }

    const buttons = [
      navButtons,
      [Markup.button.callback('Хочу заказать 🚗', `order:${car.id}`)],
      [Markup.button.url('🌐 На сайте', link)],
      [Markup.button.callback('◀️ Меню', 'menu')],
    ];
    const keyboard = Markup.inlineKeyboard(buttons);

    // ---------- Отправка с фото ----------
    const baseUrl = process.env.API_BASE_URL || siteUrl();
    const resolveImg = (src) => src?.startsWith('http') ? src : `${baseUrl}${src}`;

    const allImages = [];
    if (car.image) allImages.push(resolveImg(car.image));
    if (car.image2) allImages.push(resolveImg(car.image2));
    if (Array.isArray(car.images)) {
      car.images.slice(0, 8).forEach(img => {
        const url = resolveImg(img);
        if (!allImages.includes(url)) allImages.push(url);
      });
    }

    // Удаляем предыдущее сообщение при листании
    if (edit) {
      try { await ctx.deleteMessage(); } catch { /* ok */ }
    }

    if (allImages.length > 1) {
      const mediaGroup = allImages.slice(0, 4).map((url) => ({
        type: 'photo',
        media: url,
      }));
      try {
        await ctx.replyWithMediaGroup(mediaGroup);
      } catch { /* photos failed */ }
      return ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
    } else if (allImages.length === 1) {
      try {
        return await ctx.replyWithPhoto(
          { url: allImages[0] },
          { caption, parse_mode: 'HTML', ...keyboard }
        );
      } catch {
        return ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
      }
    }

    return ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
  } catch (err) {
    console.error('[CatalogBot] carList error:', err);
    return ctx.reply('❌ Ошибка загрузки каталога.');
  }
}

function buildListCallback(filters, page) {
  if (filters.brand) return `brand:${filters.brand}:${page}`;
  // Комбинированный фильтр: кузов + бюджет
  if (filters.body_type && (filters.price_min || filters.price_max)) {
    return `combo:${filters.body_type}:${filters.price_min || 0}:${filters.price_max || 0}:${page}`;
  }
  if (filters.body_type) return `body:${filters.body_type}:${page}`;
  if (filters.price_min || filters.price_max) return `budgetpage:${filters.price_min || 0}:${filters.price_max || 0}:${page}`;
  return `catalog:all:${page}`;
}

/**
 * Отправить список марок
 */
async function sendBrands(ctx, page, edit = false) {
  try {
    const { rows } = await pool.query(`
      SELECT TRIM(brand) AS name, COUNT(*)::int AS count
      FROM cars WHERE is_published = true AND brand IS NOT NULL AND brand != ''
      GROUP BY TRIM(brand) ORDER BY count DESC
    `);

    const total = rows.length;
    const totalPages = Math.ceil(total / BRANDS_PER_PAGE);
    const offset = page * BRANDS_PER_PAGE;
    const slice = rows.slice(offset, offset + BRANDS_PER_PAGE);

    const text = `🏷 <b>Марки авто</b>\nВсего марок: ${total} | Стр. ${page + 1}/${totalPages}`;

    const brandButtons = slice.map((b) => [
      Markup.button.callback(`${b.name} (${b.count})`, `brand:${b.name}:0`),
    ]);

    const navButtons = [];
    if (page > 0) navButtons.push(Markup.button.callback('⬅️', `brands:${page - 1}`));
    navButtons.push(Markup.button.callback(`${page + 1}/${totalPages}`, 'noop'));
    if (page + 1 < totalPages) navButtons.push(Markup.button.callback('➡️', `brands:${page + 1}`));

    const keyboard = Markup.inlineKeyboard([
      ...brandButtons,
      navButtons,
      [Markup.button.callback('◀️ Меню', 'menu')],
    ]);

    return safeReply(ctx, text, { parse_mode: 'HTML', ...keyboard }, edit);
  } catch (err) {
    console.error('[CatalogBot] brands error:', err);
    return safeReply(ctx, '❌ Ошибка.', {}, edit);
  }
}

/**
 * Отправить список типов кузова
 */
async function sendBodies(ctx, page, edit = false) {
  try {
    const { rows } = await pool.query(`
      SELECT TRIM(body_type) AS name, COUNT(*)::int AS count
      FROM cars WHERE is_published = true AND body_type IS NOT NULL AND body_type != ''
      GROUP BY TRIM(body_type) ORDER BY count DESC
    `);

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / BRANDS_PER_PAGE));
    const offset = page * BRANDS_PER_PAGE;
    const slice = rows.slice(offset, offset + BRANDS_PER_PAGE);

    const text = `🏎 <b>Типы кузова</b>\nВсего: ${total} | Стр. ${page + 1}/${totalPages}`;

    const bodyButtons = slice.map((b) => [
      Markup.button.callback(`${b.name} (${b.count})`, `body:${b.name}:0`),
    ]);

    const navButtons = [];
    if (page > 0) navButtons.push(Markup.button.callback('⬅️', `bodies:${page - 1}`));
    navButtons.push(Markup.button.callback(`${page + 1}/${totalPages}`, 'noop'));
    if (page + 1 < totalPages) navButtons.push(Markup.button.callback('➡️', `bodies:${page + 1}`));

    const keyboard = Markup.inlineKeyboard([
      ...bodyButtons,
      navButtons,
      [Markup.button.callback('◀️ Меню', 'menu')],
    ]);

    return safeReply(ctx, text, { parse_mode: 'HTML', ...keyboard }, edit);
  } catch (err) {
    console.error('[CatalogBot] bodies error:', err);
    return safeReply(ctx, '❌ Ошибка.', {}, edit);
  }
}

/**
 * Детальная карточка авто
 */
async function sendCarDetail(ctx, carId, edit = false) {
  try {
    const { rows } = await pool.query('SELECT * FROM cars WHERE id = $1 AND is_published = true', [carId]);
    if (!rows.length) {
      const text = '😔 Авто не найдено или снято с публикации.';
      return safeReply(ctx, text, {}, edit);
    }

    const car = rows[0];
    const caption = carCaption(car);
    const link = `${siteUrl()}/car/${car.id}`;

    // Ищем следующее авто для кнопки "Показать ещё"
    const nextRes = await pool.query(
      'SELECT id FROM cars WHERE is_published = true AND id < $1 ORDER BY id DESC LIMIT 1',
      [carId]
    );
    const nextCarId = nextRes.rows[0]?.id;

    const buttons = [];
    if (nextCarId) {
      buttons.push([Markup.button.callback('Показать ещё ➡️', `car:${nextCarId}`)]);
    }
    buttons.push([Markup.button.callback('Хочу заказать 🚗', `order:${car.id}`)]);
    buttons.push([Markup.button.url('🌐 Смотреть на сайте', link)]);
    buttons.push([Markup.button.callback('◀️ Назад', car.brand ? `brand:${car.brand.trim()}:0` : 'catalog:all:0'), Markup.button.callback('🏠 Меню', 'menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);

    // Пробуем отправить с фото
    const baseUrl = process.env.API_BASE_URL || siteUrl();
    const resolveImg = (src) => src?.startsWith('http') ? src : `${baseUrl}${src}`;

    // Собираем все фото
    const allImages = [];
    if (car.image) allImages.push(resolveImg(car.image));
    if (car.image2) allImages.push(resolveImg(car.image2));
    if (Array.isArray(car.images)) {
      car.images.slice(0, 8).forEach(img => {
        const url = resolveImg(img);
        if (!allImages.includes(url)) allImages.push(url);
      });
    }

    // Удаляем предыдущее сообщение если edit
    if (edit) {
      try { await ctx.deleteMessage(); } catch { /* ok */ }
    }

    if (allImages.length > 1) {
      // Отправляем медиагруппу (до 4 фото) + отдельное сообщение с текстом и кнопками
      const mediaGroup = allImages.slice(0, 4).map((url, i) => ({
        type: 'photo',
        media: url,
      }));

      try {
        await ctx.replyWithMediaGroup(mediaGroup);
      } catch { /* photos failed */ }
      return ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
    } else if (allImages.length === 1) {
      try {
        return await ctx.replyWithPhoto(
          { url: allImages[0] },
          { caption, parse_mode: 'HTML', ...keyboard }
        );
      } catch {
        return ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
      }
    }

    return safeReply(ctx, caption, { parse_mode: 'HTML', ...keyboard }, edit);
  } catch (err) {
    console.error('[CatalogBot] carDetail error:', err);
    return safeReply(ctx, '❌ Ошибка.', {}, edit);
  }
}

/**
 * Статистика
 */
async function sendStats(ctx, edit = false) {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(DISTINCT TRIM(brand))::int AS brands,
        MIN(price) FILTER (WHERE price > 0)::bigint AS price_min,
        MAX(price)::bigint AS price_max,
        MIN(year) AS year_min,
        MAX(year) AS year_max
      FROM cars WHERE is_published = true
    `);
    const s = rows[0];

    const text =
      `📊 <b>Статистика каталога</b>\n\n` +
      `🚗 Всего авто: ${s.total}\n` +
      `🏷 Марок: ${s.brands}\n` +
      `💰 Цена: ${formatPrice(s.price_min)} – ${formatPrice(s.price_max)}\n` +
      `📅 Год: ${s.year_min || '—'} – ${s.year_max || '—'}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('◀️ Меню', 'menu')],
    ]);

    return safeReply(ctx, text, { parse_mode: 'HTML', ...keyboard }, edit);
  } catch (err) {
    console.error('[CatalogBot] stats error:', err);
    return safeReply(ctx, '❌ Ошибка.', {}, edit);
  }
}

export default catalogBot;
