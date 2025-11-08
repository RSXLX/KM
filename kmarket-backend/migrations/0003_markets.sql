-- markets
CREATE TABLE IF NOT EXISTS markets (
  id SERIAL PRIMARY KEY,
  market_id BIGINT UNIQUE NOT NULL,
  title VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'general',
  status market_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMP DEFAULT NULL,
  closed_at TIMESTAMP DEFAULT NULL,
  settled_at TIMESTAMP DEFAULT NULL,
  winning_option SMALLINT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  admin_user_id INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_created ON markets(created_at);