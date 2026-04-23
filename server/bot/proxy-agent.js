/**
 * Возвращает HTTP-агент для Telegraf в зависимости от TELEGRAM_PROXY_URL.
 *
 * Поддерживаемые схемы (определяются автоматически):
 *   http://[user:pass@]host:port
 *   https://[user:pass@]host:port
 *   socks4://[user:pass@]host:port
 *   socks5://[user:pass@]host:port
 *
 * Если TELEGRAM_PROXY_URL не задан — IPv4 fallback (обходит broken IPv6).
 *
 * .env:
 *   TELEGRAM_PROXY_URL=socks5://user:pass@host:port
 */

import https from 'https';
import { ProxyAgent } from 'proxy-agent';

export function getTelegramAgent() {
  const proxyUrl = process.env.TELEGRAM_PROXY_URL;

  if (!proxyUrl) {
    console.log('ℹ️  TELEGRAM_PROXY_URL не задан — используется IPv4 fallback');
    return new https.Agent({ family: 4 });
  }

  try {
    const masked = proxyUrl.replace(/:[^:@]+@/, ':***@');
    console.log(`🔌 Telegram боты → прокси: ${masked}`);
    return new ProxyAgent(proxyUrl);
  } catch (err) {
    console.error('❌ Ошибка создания прокси-агента:', err.message);
    console.log('⚠️  Фолбэк на IPv4 без прокси');
    return new https.Agent({ family: 4 });
  }
}
