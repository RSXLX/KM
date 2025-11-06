-- Markets table
CREATE TABLE IF NOT EXISTS markets (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table (from guide)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id BIGINT UNIQUE NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  market_id BIGINT NOT NULL,
  amount NUMERIC(78,0) NOT NULL,
  odds INTEGER NOT NULL,
  option SMALLINT NOT NULL,
  potential_payout NUMERIC(78,0),
  settled BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_address);
CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(settled, claimed);