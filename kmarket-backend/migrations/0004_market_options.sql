-- market_options
CREATE TABLE IF NOT EXISTS market_options (
  id SERIAL PRIMARY KEY,
  market_id BIGINT NOT NULL REFERENCES markets(market_id) ON DELETE CASCADE,
  code SMALLINT NOT NULL,
  label VARCHAR(64) NOT NULL,
  initial_odds INTEGER DEFAULT NULL,
  UNIQUE (market_id, code)
);
CREATE INDEX IF NOT EXISTS idx_market_options_market ON market_options(market_id);