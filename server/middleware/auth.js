import jwt from 'jsonwebtoken';

/**
 * Middleware: проверяет JWT из заголовка Authorization: Bearer <token>
 * При успехе кладёт payload в req.user
 */
export default function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный или истёкший токен' });
  }
}
