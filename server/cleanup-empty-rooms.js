import pool from './db/pool.js';

const { rowCount } = await pool.query(
  `DELETE FROM chat_rooms WHERE NOT EXISTS (SELECT 1 FROM chat_messages m WHERE m.room_id = chat_rooms.id)`
);
console.log('Deleted empty rooms:', rowCount);
process.exit(0);
