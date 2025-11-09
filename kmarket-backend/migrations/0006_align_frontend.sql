-- Add frontend-aligned columns to markets
ALTER TABLE markets ADD COLUMN IF NOT EXISTS market_address VARCHAR(128);
ALTER TABLE markets ADD COLUMN IF NOT EXISTS home_code INT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS away_code INT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS home_name VARCHAR(128);
ALTER TABLE markets ADD COLUMN IF NOT EXISTS away_name VARCHAR(128);
ALTER TABLE markets ADD COLUMN IF NOT EXISTS close_time TIMESTAMPTZ;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS state INT DEFAULT 1 NOT NULL;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS result INT DEFAULT 0 NOT NULL;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS odds_home_bps INT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS odds_away_bps INT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS max_exposure NUMERIC(38,18) DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS current_exposure NUMERIC(38,18) DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS total_volume NUMERIC(38,18) DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS total_bets INT DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Initialization: set close_time from end_time when available
UPDATE markets SET close_time = end_time WHERE close_time IS NULL AND end_time IS NOT NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_markets_market_address ON markets (market_address);
CREATE INDEX IF NOT EXISTS idx_markets_state ON markets (state);
CREATE INDEX IF NOT EXISTS idx_markets_result ON markets (result);

-- Create positions view aligned to frontend Position type
CREATE OR REPLACE VIEW positions_v AS
SELECT
    o.id AS id,
    o.user_id AS user_id,
    o.market_id AS market_id,
    u.address AS wallet_address,
    m.market_address AS market_address,
    NULL::TEXT AS bet_address,
    o.id AS nonce,
    'OPEN'::TEXT AS position_type,
    CASE WHEN o.option = 0 THEN 1 ELSE 2 END AS selected_team,
    o.amount::NUMERIC AS amount, -- Keep NUMERIC; front-end can convert if needed
    ROUND(o.odds * 10000)::INT AS multiplier_bps,
    NULL::INT AS odds_home_bps,
    NULL::INT AS odds_away_bps,
    NULL::NUMERIC AS payout_expected,
    CASE o.status WHEN 'placed' THEN 1 WHEN 'cancelled' THEN 4 WHEN 'settled' THEN 2 ELSE 1 END AS status,
    FALSE AS is_claimed,
    0::NUMERIC AS pnl,
    0::NUMERIC AS fee_paid,
    NULL::NUMERIC AS close_price,
    NULL::NUMERIC AS close_pnl,
    o.created_at AS timestamp,
    o.created_at AS created_at,
    o.updated_at AS updated_at,
    NULL::TIMESTAMPTZ AS closed_at,
    NULL::TEXT AS transaction_signature,
    NULL::BIGINT AS block_slot,
    'pending'::TEXT AS confirmation_status
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN markets m ON m.id = o.market_id;