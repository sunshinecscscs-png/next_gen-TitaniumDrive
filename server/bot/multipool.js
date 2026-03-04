/**
 * Multi-pool manager — управляет подключениями к БД разных сайтов.
 *
 * Читает конфигурацию из sites.json и создаёт отдельный pg.Pool
 * для каждого сайта.
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let sites = [];
const pools = new Map(); // index → pg.Pool

/**
 * Загружает sites.json и создаёт пулы
 * @returns {Array} массив конфигов сайтов
 */
export function loadSites() {
  try {
    const raw = readFileSync(join(__dirname, 'sites.json'), 'utf8');
    sites = JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️  sites.json не найден или повреждён:', err.message);
    sites = [];
    return sites;
  }

  for (let i = 0; i < sites.length; i++) {
    if (!pools.has(i)) {
      const { db } = sites[i];
      const p = new pg.Pool({
        host: db.host,
        port: Number(db.port) || 5432,
        database: db.database,
        user: db.user,
        password: db.password,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 5,
      });
      // Ловим ошибки пула, чтобы не крашить процесс
      p.on('error', (err) => {
        console.error(`[MultiPool] Ошибка пула «${sites[i].name}»:`, err.message);
      });
      pools.set(i, p);
    }
  }

  console.log(`📋 Загружено сайтов: ${sites.length} — ${sites.map(s => s.name).join(', ')}`);
  return sites;
}

/** @returns {Array} текущий массив сайтов */
export function getSites() {
  return sites;
}

/** @returns {pg.Pool} пул по индексу сайта */
export function getPool(index) {
  return pools.get(index);
}

/** Перезагрузить конфигурацию (hot-reload) */
export function reloadSites() {
  // Закрываем старые пулы
  for (const [, pool] of pools) {
    pool.end().catch(() => {});
  }
  pools.clear();
  return loadSites();
}
