import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import auth from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'cars');

/* Ensure directory exists */
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const router = Router();

/* Middleware: только admin */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

/* Multer storage */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 30 }, // 10 MB per file, max 30 files
});

/* ───── POST /api/upload/cars — upload up to 30 images ───── */
router.post('/cars', auth, requireAdmin, upload.array('images', 30), (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: 'Нет файлов для загрузки' });
    }
    const urls = req.files.map((f) => `/uploads/cars/${f.filename}`);
    res.json({ urls });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

/* ───── DELETE /api/upload/cars/:filename — delete a single image ───── */
router.delete('/cars/:filename', auth, requireAdmin, (req, res) => {
  try {
    const filePath = path.join(UPLOADS_DIR, path.basename(req.params.filename));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete upload error:', err);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

export default router;
