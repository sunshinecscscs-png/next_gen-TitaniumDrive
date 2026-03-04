import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

// Ловим ошибки пула (idle-клиенты), чтобы не крашить процесс
pool.on('error', (err) => {
  console.error('⚠️  [DB Pool] Ошибка idle-клиента:', err.message);
});

export default pool;
