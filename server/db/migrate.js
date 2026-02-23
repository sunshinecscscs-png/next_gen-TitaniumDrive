import pool from './pool.js';

const up = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100)        NOT NULL,
  surname       VARCHAR(100),
  patronymic    VARCHAR(100),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255)        NOT NULL,
  phone         VARCHAR(30),
  address       VARCHAR(500),
  birth_date    DATE,
  gender        VARCHAR(10),
  role          VARCHAR(20)         NOT NULL DEFAULT 'user',
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS cars (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255)        NOT NULL,
  spec          VARCHAR(255),
  price         BIGINT              NOT NULL DEFAULT 0,
  old_price     BIGINT,
  condition     VARCHAR(50)         DEFAULT 'Новое авто',
  brand         VARCHAR(100),
  model         VARCHAR(100),
  year          INTEGER,
  body_type     VARCHAR(50),
  fuel          VARCHAR(50),
  drive         VARCHAR(50),
  transmission  VARCHAR(100),
  engine        VARCHAR(100),
  power         VARCHAR(100),
  consumption   VARCHAR(50),
  acceleration  VARCHAR(50),
  trunk         VARCHAR(50),
  color_name    VARCHAR(255),
  color_hex     VARCHAR(20)         DEFAULT '#cccccc',
  city          VARCHAR(100),
  dealer        VARCHAR(255),
  image         TEXT,
  image2        TEXT,
  images        JSONB            DEFAULT '[]'::jsonb,
  description   TEXT,
  is_published  BOOLEAN             NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cars_brand ON cars (brand);
CREATE INDEX IF NOT EXISTS idx_cars_published ON cars (is_published);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  car_id     INTEGER NOT NULL REFERENCES cars(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, car_id)
);

CREATE TABLE IF NOT EXISTS callback_requests (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(20) NOT NULL DEFAULT 'simple',
  name       VARCHAR(100) NOT NULL,
  phone      VARCHAR(30) NOT NULL,
  email      VARCHAR(255),
  car_id     INTEGER REFERENCES cars(id) ON DELETE SET NULL,
  car_name   VARCHAR(255),
  topic      VARCHAR(100),
  order_number VARCHAR(100),
  message    TEXT,
  status     VARCHAR(20) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_callback_requests_status ON callback_requests (status);
CREATE INDEX IF NOT EXISTS idx_callback_requests_type ON callback_requests (type);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL DEFAULT 'status_change',
  title      VARCHAR(255) NOT NULL,
  message    TEXT,
  link       VARCHAR(255),
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_status ON chat_rooms (status);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  room_id    INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages (room_id, created_at);
`;

/* Add columns to existing table if they don't exist */
const addColumns = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='surname') THEN
    ALTER TABLE users ADD COLUMN surname VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='patronymic') THEN
    ALTER TABLE users ADD COLUMN patronymic VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='address') THEN
    ALTER TABLE users ADD COLUMN address VARCHAR(500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='birth_date') THEN
    ALTER TABLE users ADD COLUMN birth_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='gender') THEN
    ALTER TABLE users ADD COLUMN gender VARCHAR(10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cars' AND column_name='images') THEN
    ALTER TABLE cars ADD COLUMN images JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cars' AND column_name='mileage') THEN
    ALTER TABLE cars ADD COLUMN mileage INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='callback_requests' AND column_name='user_id') THEN
    ALTER TABLE callback_requests ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='callback_requests' AND column_name='claimed_by') THEN
    ALTER TABLE callback_requests ADD COLUMN claimed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='callback_requests' AND column_name='claimed_at') THEN
    ALTER TABLE callback_requests ADD COLUMN claimed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='claimed_by') THEN
    ALTER TABLE chat_rooms ADD COLUMN claimed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='claimed_at') THEN
    ALTER TABLE chat_rooms ADD COLUMN claimed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_admin_reply') THEN
    ALTER TABLE chat_messages ADD COLUMN is_admin_reply BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='nickname') THEN
    ALTER TABLE users ADD COLUMN nickname VARCHAR(100);
  END IF;

  -- Guest chat support
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='guest_id') THEN
    ALTER TABLE chat_rooms ADD COLUMN guest_id VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='guest_name') THEN
    ALTER TABLE chat_rooms ADD COLUMN guest_name VARCHAR(100) DEFAULT 'Гость';
  END IF;
  -- Make user_id nullable for guest rooms
  BEGIN
    ALTER TABLE chat_rooms ALTER COLUMN user_id DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL;
  END;
  -- Drop unique constraint on user_id if exists, re-create as partial
  BEGIN
    ALTER TABLE chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_user_id_key;
  EXCEPTION WHEN others THEN NULL;
  END;
  -- Allow sender_id to be NULL for guest messages
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='guest_id') THEN
    ALTER TABLE chat_messages ADD COLUMN guest_id VARCHAR(100);
  END IF;
  BEGIN
    ALTER TABLE chat_messages ALTER COLUMN sender_id DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;
`;

async function migrate() {
  try {
    await pool.query(up);
    await pool.query(addColumns);
    console.log('✔  Migration complete — tables "users" & "cars" ready');
  } catch (err) {
    console.error('✖  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
