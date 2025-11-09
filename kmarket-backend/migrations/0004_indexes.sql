-- Indexes for performance (idempotent)

CREATE INDEX IF NOT EXISTS idx_users_address ON users (address);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets (status);
CREATE INDEX IF NOT EXISTS idx_markets_end_time ON markets (end_time);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_market_id ON orders (market_id);
CREATE INDEX IF NOT EXISTS idx_orders_option ON orders (option);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);