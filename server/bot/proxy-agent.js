/**
 * Возвращает HTTP-агент для Telegraf в зависимости от TELEGRAM_PROXY_URL.
 *
 * Поддерживаемые схемы:
 *   http://[user:pass@]host:port   — HTTP-прокси   (https-proxy-agent)
 *   https://[user:pass@]host:port  — HTTPS-прокси  (https-proxy-agent)
 *   socks4://[user:pass@]host:port — SOCKS4-прокси  (socks-proxy-agent)
 *   socks5://[user:pass@]host:port — SOCKS5-прокси  (socks-proxy-agent)
 *
 * Если TELEGRAM_PROXY_URL не задан — возвращает обычный Agent с family:4 (IPv4),
 * чтобы обойти отсутствующий IPv6 на сервере.
 *
 * В .env задаётся так:
 *   TELEGRAM_PROXY_URL=socks5://user:pass@proxy-host:1080
 */

import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

export function getTelegramAgent() {
  const proxyUrl = process.env.TELEGRAM_PROXY_URL;

  if (!proxyUrl) {
    // Фолбэк: принудительный IPv4 (IPv6 на сервере недоступен)
    return new https.Agent({ family: 4 });
  }

  const scheme = proxyUrl.split(':')[0].toLowerCase();

  if (scheme === 'socks4' || scheme === 'socks5') {
    console.log(`🔌 Telegram боты → SOCKS прокси: ${proxyUrl.replace(/:[^:@]+@/, ':***@')}`);
    return new SocksProxyAgent(proxyUrl);
  }

  if (scheme === 'http' || scheme === 'https') {
    console.log(`🔌 Telegram боты → HTTP прокси: ${proxyUrl.replace(/:[^:@]+@/, ':***@')}`);
    return new HttpsProxyAgent(proxyUrl);
  }

  console.warn(`⚠️  Неизвестная схема прокси "${scheme}", используется IPv4 fallback`);
  return new https.Agent({ family: 4 });
}
