import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,                       // true для порта 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },  // нужно при подключении по IP вместо домена
});

/**
 * Отправить письмо
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 */
export async function sendMail({ to, subject, html, text }) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
    text,
  });
  console.log('✉  Mail sent:', info.messageId);
  return info;
}

/**
 * Генерация 6-значного кода верификации
 */
export function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default transporter;
