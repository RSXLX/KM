-- chain_events
CREATE TABLE IF NOT EXISTS chain_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(32) NOT NULL,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMP NOT NULL,
  market_id BIGINT DEFAULT NULL REFERENCES markets(market_id) ON DELETE SET NULL,
  order_id BIGINT DEFAULT NULL REFERENCES orders(order_id) ON DELETE SET NULL,
  raw JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chain_events_market ON chain_events(market_id);
CREATE INDEX IF NOT EXISTS idx_chain_events_order ON chain_events(order_id);
CREATE INDEX IF NOT EXISTS idx_chain_events_type ON chain_events(event_type);