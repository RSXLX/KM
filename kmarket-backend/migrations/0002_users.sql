-- users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  display_name VARCHAR(64) DEFAULT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'user',
  last_login TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_role CHECK (role IN ('user','admin'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);