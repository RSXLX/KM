-- Add helpful indexes and ensure audit cascade safety (manual delete is used in repo)

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_market_id ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_market_id ON markets(market_id);

-- No cascade changes required; orders already ON DELETE CASCADE referencing markets and users