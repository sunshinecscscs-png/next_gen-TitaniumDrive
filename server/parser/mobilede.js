/**
 * mobile.de parser
 * 
 * Принимает URL объявления с mobile.de,
 * парсит тех. характеристики, функции, фото и цену.
 * Возвращает объект, готовый для вставки в cars через API.
 */

import puppeteer from 'puppeteer';
import { downloadImages } from './downloader.js';

/* ── Маппинг русских меток mobile.de → поля нашей БД ── */
const LABEL_MAP = {
  // Основные
  'категория': 'body_type',
  'тип кузова': 'body_type',
  'состояние транспортного средства': '_condition_raw',
  'состояние': '_condition_raw',
  'пробег': '_mileage_raw',
  'первая регистрация': '_first_reg',
  'объем двигателя': '_engine_raw',
  'объём двигателя': '_engine_raw',
  'мощность': '_power_raw',
  'топливо': 'fuel',
  'трансмиссия': 'transmission',
  'тип привода': '_drive_type',
  'расход топлива': '_consumption_raw',
  'энергопотребление (комб.)': '_consumption_raw',
  'цвет': 'color_name',
  'цвет по классификации производителя': '_color_manufacturer',
  'количество мест': '_seats_raw',
  'число дверей': 'doors',
  'количество владельцев': '_owners_raw',
  'вес': '_weight_raw',
  'cylinder': '_cylinders_raw',
  'цилиндры': '_cylinders_raw',
  'емкость топливного бака': 'fuel_tank',
  'ёмкость топливного бака': 'fuel_tank',
  'класс экологической безопасности': 'eco_class',
  'выбросы co₂ (комб.)': 'co2_emissions',
  'выбросы co2 (комб.)': 'co2_emissions',
  'происхождение': 'origin',
  'дизайн салона': 'interior',
  'модельный ряд': '_model_series',
  'накладная линия': '_model_line',
  'номер транспортного средства': '_vehicle_number',
  'подушки безопасности': 'airbags',
  'климатизация': 'climate',
  'наклейка, указывающая на безвредность для окружающей среды': 'env_sticker',
  'наклейка': 'env_sticker',
  'датчики парковки': '_parking_sensors',
  'hu': '_hu_raw',
  'last maintenance (date)': '_last_maintenance_date',
  'last maintenance (mileage)': '_last_maintenance_mileage',
};

/* ── Маппинг немецких меток (если язык не русский) ── */
const LABEL_MAP_DE = {
  'kategorie': 'body_type',
  'fahrzeugzustand': '_condition_raw',
  'kilometerstand': '_mileage_raw',
  'erstzulassung': '_first_reg',
  'hubraum': '_engine_raw',
  'leistung': '_power_raw',
  'kraftstoffart': 'fuel',
  'getriebe': 'transmission',
  'antrieb': '_drive_type',
  'kraftstoffverbrauch': '_consumption_raw',
  'farbe': 'color_name',
  'herstellerfarbe': '_color_manufacturer',
  'anzahl sitzplätze': '_seats_raw',
  'anzahl türen': 'doors',
  'anzahl der vorbesitzer': '_owners_raw',
  'gewicht': '_weight_raw',
  'zylinder': '_cylinders_raw',
  'tankinhalt': 'fuel_tank',
  'schadstoffklasse': 'eco_class',
  'co₂-emissionen (komb.)': 'co2_emissions',
  'herkunft': 'origin',
  'innenausstattung': 'interior',
  'modellreihe': '_model_series',
  'modell': '_model_line',
  'airbags': 'airbags',
  'klimatisierung': 'climate',
  'umweltplakette': 'env_sticker',
  'einparkhilfe': '_parking_sensors',
};

/**
 * Парсит страницу объявления mobile.de
 * @param {string} url — полный URL объявления
 * @param {object} opts — { downloadPhotos: true, maxPhotos: 30 }
 * @returns {object} — данные авто, готовые для POST /api/cars/admin/create
 */
export async function parseMobileDe(url, opts = {}) {
  const { downloadPhotos = true, maxPhotos = 50 } = opts;

  console.log(`[Parser] Запуск парсера для: ${url}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });

  try {
    const page = await browser.newPage();

    // Эмуляция обычного браузера
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // Устанавливаем русский язык
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ru-RU,ru;q=0.9' });

    console.log('[Parser] Загрузка страницы...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Принимаем cookie consent
    await acceptCookies(page);

    // Ждём загрузку контента
    await page.waitForSelector('body', { timeout: 15000 });
    await sleep(3000); // Даём время на полный рендер

    // Открываем полную галерею (кнопка "Все изображения" / "All images")
    await openFullGallery(page);

    // Извлекаем все данные
    const raw = await page.evaluate(() => {
      const data = {};

      /* ── Заголовок (название авто) ── */
      // mobile.de не использует h1, название в document.title: "Mercedes-Benz CLA 45 AMG для 28 599 €"
      // или в первом h2
      const pageTitle = document.title || '';
      const titleFromPage = pageTitle.replace(/\s*для\s*[\d\s.,]+\s*€.*/, '').replace(/\s*mobile\.de.*/, '').trim();
      const h2El = document.querySelector('h2');
      data.title = titleFromPage || h2El?.textContent?.trim() || '';

      /* ── Цена ── */
      // Целимся в конкретный элемент главной цены
      const priceEl = document.querySelector(
        '[class*="MainPriceArea_mainPrice"], [class*="StickyCTA_imagePriceWrapper"]'
      );
      data.priceText = priceEl?.textContent?.trim() || '';
      
      // Fallback: ищем первый элемент с "€" в тексте и разумной длиной
      if (!data.priceText) {
        const allPriceEls = document.querySelectorAll('[class*="price"], [class*="Price"]');
        for (const el of allPriceEls) {
          const txt = el.textContent?.trim() || '';
          if (txt.includes('€') && txt.length < 20) {
            data.priceText = txt;
            break;
          }
        }
      }

      /* ── Фотографии ── */
      data.imageUrls = [];
      const seen = new Set();

      function addImg(src) {
        if (!src || !src.startsWith('http')) return;
        // Нормализуем URL к максимальному разрешению
        let big = src
          .replace(/\/\d+x\d+/, '/1024x768')
          .replace('rule=mo-360.jpg', 'rule=mo-1024.jpg')
          .replace('rule=mo-640.jpg', 'rule=mo-1024.jpg')
          .replace(/\?.*$/, ''); // убираем query params для дедупликации
        const key = big.replace(/https?:\/\//, '');
        if (!seen.has(key)) {
          seen.add(key);
          // Добавляем обратно полный URL (с оригинальным протоколом)
          data.imageUrls.push(src.replace(/\/\d+x\d+/, '/1024x768').replace(/rule=mo-\d+\.jpg/, 'rule=mo-1024.jpg'));
        }
      }

      // Собираем ВСЕ img с classistatic.de (основной CDN mobile.de)
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset?.src || '';
        const srcset = img.srcset || '';
        if (src.includes('classistatic.de') && !src.includes('logo') && !src.includes('icon') && !src.includes('dealer')) {
          addImg(src);
        }
        // Извлекаем из srcset самую большую версию
        if (srcset.includes('classistatic.de')) {
          const parts = srcset.split(',').map(s => s.trim().split(' ')[0]);
          parts.forEach(p => {
            if (p.includes('classistatic.de') && !p.includes('logo') && !p.includes('icon')) {
              addImg(p);
            }
          });
        }
      });

      // Также проверяем <source> внутри <picture>
      document.querySelectorAll('picture source').forEach(source => {
        const srcset = source.srcset || '';
        if (srcset.includes('classistatic.de')) {
          const parts = srcset.split(',').map(s => s.trim().split(' ')[0]);
          parts.forEach(p => addImg(p));
        }
      });

      // Fallback: попробуем селекторы галереи
      if (data.imageUrls.length === 0) {
        const imgSelectors = [
          'img[data-testid="gallery-image"]',
          '[class*="Gallery"] img',
          '[class*="gallery"] img',
          '[class*="image-gallery"] img',
        ];
        for (const sel of imgSelectors) {
          document.querySelectorAll(sel).forEach(el => {
            addImg(el.src || el.dataset?.src || '');
          });
          if (data.imageUrls.length > 0) break;
        }
      }

      /* ── Тех. сведения (key-value пары) ── */
      data.specs = {};
      
      // Стратегия 1: находим секцию "Технические сведения" и парсим dt/dd внутри неё
      const techSection = Array.from(document.querySelectorAll('div, section')).find(sec => {
        const heading = sec.querySelector('h2, h3');
        return heading && heading.textContent?.match(/технические сведения|technical data|technische daten/i);
      });

      if (techSection) {
        const dtEls = techSection.querySelectorAll('dt');
        dtEls.forEach(dt => {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === 'DD') {
            const key = dt.textContent?.trim().toLowerCase();
            const val = dd.textContent?.trim();
            if (key && val && key.length < 80 && val.length < 200) {
              data.specs[key] = val;
            }
          }
        });
      }

      // Стратегия 1.5: также парсим секцию "История" для извлечения года (первая регистрация)
      const historySection = Array.from(document.querySelectorAll('div, section')).find(sec => {
        const heading = sec.querySelector('h2, h3');
        return heading && heading.textContent?.match(/история|history|historie/i);
      });
      if (historySection) {
        const dtEls = historySection.querySelectorAll('dt');
        dtEls.forEach(dt => {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === 'DD') {
            const key = dt.textContent?.trim().toLowerCase();
            const val = dd.textContent?.trim();
            if (key && val && (key.includes('регистрац') || key.includes('erstzulassung'))) {
              data.specs[key] = val;
            }
          }
        });
      }

      // Стратегия 2: если секция не найдена, ищем dt/dd глобально но фильтруем мусор
      if (Object.keys(data.specs).length < 3) {
        const knownKeys = [
          'категория', 'состояние', 'пробег', 'объем двигателя', 'объём двигателя',
          'мощность', 'топливо', 'трансмиссия', 'тип привода', 'расход топлива',
          'цвет', 'количество мест', 'число дверей', 'количество владельцев',
          'вес', 'емкость топливного бака', 'ёмкость топливного бака', 'первая регистрация',
          'класс экологической безопасности', 'выбросы', 'происхождение', 'дизайн салона',
          'модельный ряд', 'накладная линия', 'номер транспортного средства', 'cylinder',
          'цилиндры', 'энергопотребление', 'цвет по классификации', 'hu',
          'klimatisierung', 'датчики парковки', 'подушки безопасности',
          'категория', 'category', 'fahrzeugzustand', 'kilometerstand',
        ];
        const allDts = document.querySelectorAll('dt');
        allDts.forEach(dt => {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === 'DD') {
            const key = dt.textContent?.trim().toLowerCase();
            const val = dd.textContent?.trim();
            const isKnown = knownKeys.some(k => key.includes(k));
            if (key && val && isKnown && val.length < 200) {
              data.specs[key] = val;
            }
          }
        });
      }

      /* ── Функции/опции ── */
      data.features = [];
      // Ищем список функций с галочками
      const featureSelectors = [
        '[class*="Feature"] li',
        '[class*="feature"] li',
        '[class*="Equipment"] li',
        '[class*="equipment"] li',
      ];
      for (const sel of featureSelectors) {
        const items = document.querySelectorAll(sel);
        items.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length < 100) data.features.push(text);
        });
        if (data.features.length > 0) break;
      }

      // Fallback: ищем checkmark + текст
      if (data.features.length === 0) {
        const allText = document.body.innerHTML;
        // Ищем секцию "Функции" или "Ausstattung"
        const sections = document.querySelectorAll('div, section');
        sections.forEach(sec => {
          const heading = sec.querySelector('h2, h3, h4');
          if (heading && (heading.textContent?.match(/функции|ausstattung|equipment|features/i))) {
            const items = sec.querySelectorAll('span, li, div');
            items.forEach(el => {
              const txt = el.textContent?.trim();
              if (txt && txt.length > 2 && txt.length < 80 && !txt.match(/функции|ausstattung|показать/i)) {
                // Проверяем что это не заголовок секции
                if (el.tagName !== 'H2' && el.tagName !== 'H3' && el.tagName !== 'H4') {
                  if (!data.features.includes(txt)) {
                    data.features.push(txt);
                  }
                }
              }
            });
          }
        });
      }

      /* ── Описание продавца ── */
      const descEl = document.querySelector(
        '[data-testid="seller-notes"], [class*="description"], [class*="Description"]'
      );
      data.description = descEl?.textContent?.trim() || '';

      return data;
    });

    console.log(`[Parser] Получено: ${Object.keys(raw.specs).length} хар-к, ${raw.imageUrls.length} фото, ${raw.features.length} опций`);

    // Маппинг полей
    const mapped = mapSpecsToFields(raw.specs);

    // Парсим цену
    const price = parsePrice(raw.priceText);

    // Определяем бренд/модель из заголовка
    const { brand, model, fullName } = parseTitle(raw.title, mapped);

    // Определяем год
    const year = parseYear(mapped._first_reg);

    // Скачиваем фото
    let localImages = [];
    let mainImage = null;
    let secondImage = null;

    if (downloadPhotos && raw.imageUrls.length > 0) {
      console.log(`[Parser] Скачивание ${Math.min(raw.imageUrls.length, maxPhotos)} фото...`);
      localImages = await downloadImages(raw.imageUrls.slice(0, maxPhotos));
      mainImage = localImages[0] || null;
      secondImage = localImages[1] || null;
    } else {
      mainImage = raw.imageUrls[0] || null;
      secondImage = raw.imageUrls[1] || null;
      localImages = raw.imageUrls.slice(0, maxPhotos);
    }

    // Собираем результат
    const result = {
      name: fullName || raw.title || 'Без названия',
      spec: mapped._model_line || mapped._model_series || null,
      price: price || 0,
      old_price: null,
      condition: mapCondition(mapped._condition_raw),
      brand,
      model,
      year,
      body_type: mapBodyType(mapped.body_type),
      fuel: mapFuel(mapped.fuel),
      drive: mapDrive(mapped._drive_type) || detectDriveFromFeatures(raw.features),
      transmission: mapTransmission(mapped.transmission),
      engine: formatEngine(mapped._engine_raw),
      power: mapped._power_raw || null,
      consumption: mapped._consumption_raw || null,
      acceleration: null,
      trunk: null,
      color_name: mapped.color_name || mapped._color_manufacturer || null,
      color_hex: '#cccccc',
      city: null,
      dealer: null,
      image: mainImage,
      image2: secondImage,
      images: localImages,
      description: raw.description || null,
      is_published: false, // По умолчанию скрыто — админ проверит и включит
      mileage: parseMileage(mapped._mileage_raw),
      seats: mapped._seats_raw ? parseInt(mapped._seats_raw) || null : null,
      doors: mapped.doors || null,
      // owners, origin, first_registration — не парсим (История)
      owners: null,
      weight: parseWeight(mapped._weight_raw),
      cylinders: mapped._cylinders_raw ? parseInt(mapped._cylinders_raw) || null : null,
      fuel_tank: mapped.fuel_tank || null,
      eco_class: mapped.eco_class || null,
      co2_emissions: mapped.co2_emissions || null,
      features: raw.features || [],
      origin: null,
      interior: mapped.interior || null,
      source_url: url,
      first_registration: null,
      airbags: mapped.airbags || null,
      climate: mapped.climate || null,
      env_sticker: mapped.env_sticker || null,
      // Оригинальные CDN-ссылки (для сохранения на удалённых сайтах)
      imageUrls: raw.imageUrls || [],
    };

    console.log(`[Parser] ✔ Результат: ${result.name}, ${result.price}€, ${localImages.length} фото`);
    return result;

  } finally {
    await browser.close();
  }
}

/* ═══════════════════ Helpers ═══════════════════ */

async function acceptCookies(page) {
  try {
    // mobile.de consent buttons
    const selectors = [
      'button[aria-label="Согласен"]',
      'button[aria-label="Einverstanden"]',
      'button[aria-label="Accept"]',
      '#consent-accept',
      '[data-testid="consent-accept"]',
      'button.mde-consent-accept-btn',
      'button:has-text("Согласен")',
      'button:has-text("Einverstanden")',
    ];

    for (const sel of selectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          console.log('[Parser] Cookie consent принят');
          await sleep(2000);
          return;
        }
      } catch { /* ignore */ }
    }

    // Fallback: ищем по тексту кнопки
    const accepted = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = buttons.find(b => {
        const text = b.textContent?.trim().toLowerCase();
        return text === 'согласен' || text === 'einverstanden' || text === 'accept' || text === 'accept all';
      });
      if (acceptBtn) {
        acceptBtn.click();
        return true;
      }
      return false;
    });

    if (accepted) {
      console.log('[Parser] Cookie consent принят (через evaluate)');
      await sleep(2000);
    } else {
      console.log('[Parser] Cookie consent не найден — возможно уже принят');
    }
  } catch (err) {
    console.log('[Parser] Cookie consent — ошибка:', err.message);
  }
}

/**
 * Кликает на галерею/кнопку "Все изображения", чтобы загрузить полный список фото.
 */
async function openFullGallery(page) {
  try {
    // Стратегия 1: клик по превью-изображению, чтобы открыть галерею
    const galleryOpened = await page.evaluate(() => {
      // Ищем кнопку "все фото" / "all images" / счётчик фото
      const btns = Array.from(document.querySelectorAll('button, a, div, span'));
      const trigger = btns.find(el => {
        const txt = (el.textContent || '').toLowerCase().trim();
        return (
          txt.match(/все\s*(фото|изображени|картинк)/i) ||
          txt.match(/all\s*images/i) ||
          txt.match(/alle\s*bilder/i) ||
          txt.match(/^\d+\s*(фото|изображ|bilder|images|photos)$/i) ||
          txt.match(/показать\s*все/i)
        );
      });
      if (trigger) { trigger.click(); return 'button'; }

      // Ищем элемент-счётчик фото на галерее (например "1/29")
      const counterEl = btns.find(el => {
        const txt = (el.textContent || '').trim();
        return /^\d+\s*\/\s*\d+$/.test(txt);
      });
      if (counterEl) { counterEl.click(); return 'counter'; }

      // Клик по главному изображению, чтобы открыть лайтбокс
      const mainImg = document.querySelector(
        '[class*="Gallery"] img, [class*="gallery"] img, [data-testid="gallery-image"], img[src*="classistatic.de"]'
      );
      if (mainImg) { mainImg.click(); return 'image'; }

      return null;
    });

    if (galleryOpened) {
      console.log(`[Parser] Галерея открыта (${galleryOpened})`);
      await sleep(2000);

      // Прокручиваем галерею до конца, чтобы lazy-load подгрузил всё
      await scrollGallery(page);
    } else {
      console.log('[Parser] Кнопка галереи не найдена — используем видимые фото');
    }
  } catch (err) {
    console.log('[Parser] Ошибка открытия галереи:', err.message);
  }
}

/**
 * Прокручивает модалку галереи / слайдер, кликая "вперёд" чтобы подгрузить все фото.
 */
async function scrollGallery(page) {
  try {
    // Определяем сколько всего фото (ищем "1/29" паттерн)
    const totalImages = await page.evaluate(() => {
      const els = document.querySelectorAll('*');
      for (const el of els) {
        const txt = (el.textContent || '').trim();
        const m = txt.match(/(\d+)\s*\/\s*(\d+)/);
        if (m && el.children.length === 0 && parseInt(m[2]) > 1) {
          return parseInt(m[2]);
        }
      }
      return 0;
    });

    if (totalImages > 5) {
      console.log(`[Parser] Прокрутка галереи: ${totalImages} фото`);
      // Кликаем "вперёд" N раз, чтобы все картинки загрузились
      for (let i = 0; i < totalImages + 2; i++) {
        const clicked = await page.evaluate(() => {
          // Кнопка "вперёд" в лайтбоксе
          const nextBtn = document.querySelector(
            'button[aria-label="next"], button[aria-label="Next"], ' +
            'button[aria-label="Вперёд"], button[aria-label="Weiter"], ' +
            '[class*="next" i], [class*="Next" i], ' +
            '[class*="right-arrow" i], [class*="arrow-right" i], ' +
            '[class*="slick-next"]'
          );
          if (nextBtn) { nextBtn.click(); return true; }
          return false;
        });
        if (!clicked) break;
        await sleep(300);
      }
      await sleep(1000);
    }
  } catch (err) {
    console.log('[Parser] Ошибка прокрутки галереи:', err.message);
  }
}

function mapSpecsToFields(specs) {
  const result = {};
  for (const [rawKey, value] of Object.entries(specs)) {
    const key = rawKey.trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[²³]/, '')
      .replace(/\s*\(комб\.\)/, ' (комб.)')
      .replace(/\u00B2/g, '');

    // Пробуем русский маппинг
    for (const [label, field] of Object.entries(LABEL_MAP)) {
      if (key.includes(label.toLowerCase())) {
        result[field] = value;
        break;
      }
    }
    // Пробуем немецкий маппинг
    if (!Object.values(result).includes(value)) {
      for (const [label, field] of Object.entries(LABEL_MAP_DE)) {
        if (key.includes(label.toLowerCase())) {
          result[field] = value;
          break;
        }
      }
    }
  }
  return result;
}

function parseTitle(title, mapped) {
  if (!title) return { brand: null, model: null, fullName: null };

  // mobile.de title обычно: "Mercedes-Benz CLA 45 AMG 4Matic (117.352)"
  // или "BMW 320d xDrive Touring M Sport"
  const knownBrands = [
    'Mercedes-Benz', 'Mercedes', 'BMW', 'Audi', 'Volkswagen', 'VW', 'Porsche',
    'Toyota', 'Honda', 'Nissan', 'Mazda', 'Suzuki', 'Lexus', 'Infiniti',
    'Ford', 'Chevrolet', 'Opel', 'Peugeot', 'Renault', 'Citroën', 'Citroen',
    'Fiat', 'Alfa Romeo', 'Maserati', 'Ferrari', 'Lamborghini',
    'Hyundai', 'Kia', 'Genesis', 'SsangYong',
    'Volvo', 'Saab', 'Skoda', 'SEAT', 'Cupra',
    'Jaguar', 'Land Rover', 'Range Rover', 'Mini', 'Bentley', 'Rolls-Royce',
    'Tesla', 'Rivian', 'Lucid',
    'Subaru', 'Mitsubishi', 'Dacia', 'Lancia',
    'Dodge', 'Jeep', 'Chrysler', 'Cadillac', 'Buick', 'GMC', 'Lincoln',
    'Aston Martin', 'McLaren', 'Bugatti', 'Pagani',
    'Smart', 'DS', 'Alpine', 'Lotus', 'Morgan',
  ];

  let brand = null;
  let model = title;

  for (const b of knownBrands) {
    if (title.toLowerCase().startsWith(b.toLowerCase())) {
      brand = b;
      model = title.slice(b.length).trim();
      // Чистим скобки и код модели
      model = model.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      break;
    }
  }

  const fullName = title.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

  return { brand, model, fullName };
}

function parsePrice(text) {
  if (!text) return 0;
  // Извлекаем число: "28.490 €" → 28490, "28 490 EUR" → 28490
  const cleaned = text.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseInt(cleaned) || 0;
  return num;
}

function parseYear(firstReg) {
  if (!firstReg) return null;
  // "04/2017" → 2017, "2017" → 2017
  const match = firstReg.match(/(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

function parseMileage(raw) {
  if (!raw) return 0;
  // "100 000 км" → 100000, "100.000 km" → 100000
  const cleaned = raw.replace(/[^\d]/g, '');
  return parseInt(cleaned) || 0;
}

function parseWeight(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d]/g, '');
  return parseInt(cleaned) || null;
}

function formatEngine(raw) {
  if (!raw) return null;
  // "1 991 ccm" → "1991 cm3/2.0 л"
  const ccm = parseInt(raw.replace(/[^\d]/g, ''));
  if (!ccm) return raw;
  const liters = (ccm / 1000).toFixed(1);
  return `${ccm} cm3/${liters} л`;
}

function mapCondition(raw) {
  if (!raw) return 'Б/У';
  const lower = raw.toLowerCase();
  if (lower.includes('новое') || lower.includes('neu') || lower.includes('new')) return 'Новое авто';
  if (lower.includes('подержан') || lower.includes('gebraucht') || lower.includes('used')) return 'Б/У';
  if (lower.includes('демо') || lower.includes('vorführ')) return 'Демо';
  return 'Б/У';
}

function mapBodyType(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const map = {
    'седан': 'Седан', 'limousine': 'Седан', 'sedan': 'Седан',
    'универсал': 'Универсал', 'kombi': 'Универсал', 'estate': 'Универсал', 'touring': 'Универсал',
    'хэтчбек': 'Хэтчбек', 'хетчбэк': 'Хэтчбек', 'hatchback': 'Хэтчбек',
    'купе': 'Купе', 'coupe': 'Купе', 'coupé': 'Купе',
    'кабриолет': 'Кабриолет', 'cabrio': 'Кабриолет', 'cabriolet': 'Кабриолет', 'convertible': 'Кабриолет',
    'внедорожник': 'Кроссовер', 'suv': 'Кроссовер', 'кроссовер': 'Кроссовер', 'geländewagen': 'Кроссовер',
    'минивэн': 'Минивэн', 'van': 'Минивэн', 'mpv': 'Минивэн',
    'пикап': 'Пикап', 'pickup': 'Пикап',
  };
  for (const [key, val] of Object.entries(map)) {
    if (lower.includes(key)) return val;
  }
  return raw;
}

function mapFuel(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('бензин') || lower.includes('benzin') || lower.includes('petrol') || lower.includes('gasoline')) return 'Бензин';
  if (lower.includes('дизел') || lower.includes('diesel')) return 'Дизель';
  if (lower.includes('электр') || lower.includes('elektr') || lower.includes('electric')) return 'Электро';
  if (lower.includes('гибрид') || lower.includes('hybrid')) return 'Гибрид';
  if (lower.includes('газ') || lower.includes('lpg') || lower.includes('cng')) return 'Газ';
  return raw;
}

function mapDrive(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('полн') || lower.includes('allrad') || lower.includes('4x4') || lower.includes('4matic') || lower.includes('awd') || lower.includes('quattro') || lower.includes('xdrive')) return 'Полный';
  if (lower.includes('передн') || lower.includes('front') || lower.includes('vorderrad')) return 'Передний';
  if (lower.includes('задн') || lower.includes('rear') || lower.includes('hinterrad')) return 'Задний';
  // Если в тексте нет типа привода, но есть слово "двигатель"
  if (lower.includes('внутреннего сгорания') || lower.includes('verbrennung')) return null;
  return raw;
}

function mapTransmission(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('автоматич') || lower.includes('automatik') || lower.includes('automatic')) return 'Автоматическая';
  if (lower.includes('механич') || lower.includes('schaltgetriebe') || lower.includes('manual')) return 'Механическая';
  if (lower.includes('робот') || lower.includes('dsg') || lower.includes('dct')) return 'Робот';
  if (lower.includes('вариатор') || lower.includes('cvt')) return 'Вариатор';
  return raw;
}

function detectDriveFromFeatures(features) {
  if (!Array.isArray(features)) return null;
  const joined = features.join(' ').toLowerCase();
  if (joined.includes('привод на четыре колеса') || joined.includes('allrad') || joined.includes('4x4') || joined.includes('4matic')) return 'Полный';
  if (joined.includes('передний привод') || joined.includes('frontantrieb')) return 'Передний';
  if (joined.includes('задний привод') || joined.includes('hinterradantrieb')) return 'Задний';
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default parseMobileDe;
