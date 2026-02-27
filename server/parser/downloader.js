/**
 * Image downloader utility
 * 
 * Скачивает картинки по URL и сохраняет в server/uploads/cars/
 * Возвращает массив локальных путей /uploads/cars/filename.jpg
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'cars');

// Ensure uploads directory exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/**
 * Скачивает массив изображений
 * @param {string[]} urls — массив URL-ов изображений
 * @returns {string[]} — массив локальных путей (/uploads/cars/...)
 */
export async function downloadImages(urls) {
  const results = [];
  
  for (let i = 0; i < urls.length; i++) {
    try {
      const url = urls[i];
      const ext = getExtension(url);
      const filename = `${Date.now()}-${i}-${randomStr(6)}${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);

      await downloadFile(url, filePath);
      results.push(`/uploads/cars/${filename}`);

      console.log(`[Downloader] ✔ ${i + 1}/${urls.length}: ${filename}`);

      // Пауза между загрузками чтобы не нагружать
      if (i < urls.length - 1) {
        await sleep(300);
      }
    } catch (err) {
      console.error(`[Downloader] ✖ ${i + 1}/${urls.length}: ${err.message}`);
    }
  }

  return results;
}

/**
 * Скачивает один файл
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    
    const request = proto.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.mobile.de/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      timeout: 30000,
    }, (response) => {
      // Следуем редиректам
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    request.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });

    request.on('timeout', () => {
      request.destroy();
      fs.unlink(destPath, () => {});
      reject(new Error('Download timeout'));
    });
  });
}

function getExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).split('?')[0];
    if (['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'].includes(ext.toLowerCase())) {
      return ext;
    }
  } catch { /* ignore */ }
  return '.jpg';
}

function randomStr(len) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
