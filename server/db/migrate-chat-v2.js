/**
 * Migration: Add JivoChat-like fields to chat_rooms
 * - guest_phone: guest phone from pre-chat form
 * - guest_email: guest email from pre-chat form
 * - rating: 1-5 star rating from user/guest
 * - rated_at: when the rating was submitted
 *
 * Run: node server/db/migrate-chat-v2.js
 */
import pool from './pool.js';

async function migrate() {
  console.log('🔧 Running chat v2 migration...');

  await pool.query(`
    ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS guest_phone TEXT;
    ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS guest_email TEXT;
    ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS rating INT;
    ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;
  `);

  console.log('✅ chat_rooms: added guest_phone, guest_email, rating, rated_at');
  await pool.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
