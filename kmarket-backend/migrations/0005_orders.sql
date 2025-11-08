-- orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id BIGINT UNIQUE NOT NULL,
  user_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  market_id BIGINT NOT NULL REFERENCES markets(market_id),
  amount NUMERIC(78,0) NOT NULL,
  odds INTEGER NOT NULL,
  option SMALLINT NOT NULL,
  potential_payout NUMERIC(78,0) DEFAULT NULL,
  settled BOOLEAN NOT NULL DEFAULT false,
  claimed BOOLEAN NOT NULL DEFAULT false,
  tx_hash VARCHAR(66) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (market_id, option) REFERENCES market_options(market_id, code)
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_address);
CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(settled, claimed);