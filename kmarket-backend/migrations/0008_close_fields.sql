-- Add close fields to orders and aggregate total_pnl for users

ALTER TABLE orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS close_price NUMERIC(18,8);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS close_pnl NUMERIC(38,18);

-- Maintain helpful indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_closed_at ON orders (closed_at);

-- Users: add total_pnl and optional balance
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_pnl NUMERIC(38,18) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(38,18) DEFAULT 0;

-- Initialize users.total_pnl from existing orders (cancelled or settled)
UPDATE users u
SET total_pnl = COALESCE((
    SELECT COALESCE(SUM(o.close_pnl), 0)
    FROM orders o
    WHERE o.user_id = u.id AND o.status IN ('cancelled','settled')
), 0);

-- Recreate positions view with close fields mapping
CREATE OR REPLACE VIEW positions_v AS
SELECT
    o.id AS id,
    o.user_id AS user_id,
    o.market_id AS market_id,
    u.address AS wallet_address,
    m.market_address AS market_address,
    NULL::TEXT AS bet_address,
    o.id AS nonce,
    CASE WHEN o.status = 'placed' THEN 'OPEN' ELSE 'CLOSE' END AS position_type,
    CASE WHEN o.option = 0 THEN 1 ELSE 2 END AS selected_team,
    o.amount::NUMERIC AS amount,
    ROUND(o.odds * 10000)::INT AS multiplier_bps,
    m.odds_home_bps AS odds_home_bps,
    m.odds_away_bps AS odds_away_bps,
    (o.amount * o.odds)::NUMERIC AS payout_expected,
    CASE o.status WHEN 'placed' THEN 1 WHEN 'cancelled' THEN 4 WHEN 'settled' THEN 2 ELSE 1 END AS status,
    FALSE AS is_claimed,
    COALESCE(o.close_pnl, 0)::NUMERIC AS pnl,
    0::NUMERIC AS fee_paid,
    o.close_price,
    o.close_pnl AS close_pnl,
    o.created_at AS timestamp,
    o.created_at AS created_at,
    o.updated_at AS updated_at,
    o.closed_at AS closed_at,
    NULL::TEXT AS transaction_signature,
    NULL::BIGINT AS block_slot,
    'pending'::TEXT AS confirmation_status
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN markets m ON m.id = o.market_id;