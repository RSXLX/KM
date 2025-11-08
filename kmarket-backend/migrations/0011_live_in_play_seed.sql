-- Live In-Play demo seed data for markets/options/orders
-- This seed conforms to existing schema and constraints.

-- Users (admin + demo users)
INSERT INTO users (wallet_address, display_name, role)
SELECT '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Admin', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE wallet_address='0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

INSERT INTO users (wallet_address, display_name, role)
SELECT '0x1111111111111111111111111111111111111111', 'User One', 'user'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE wallet_address='0x1111111111111111111111111111111111111111');

INSERT INTO users (wallet_address, display_name, role)
SELECT '0x2222222222222222222222222222222222222222', 'User Two', 'user'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE wallet_address='0x2222222222222222222222222222222222222222');

-- Markets (active + closed/settled/cancelled)
-- NBA: Lakers vs Celtics (active)
INSERT INTO markets (market_id, title, category, status, opened_at, admin_user_id)
SELECT 2001, 'Lakers vs Celtics', 'NBA', 'active', NOW() - INTERVAL '30 minutes', (SELECT id FROM users WHERE wallet_address='0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE market_id=2001);

-- Premier League: Man City vs Arsenal (active)
INSERT INTO markets (market_id, title, category, status, opened_at, admin_user_id)
SELECT 2002, 'Man City vs Arsenal', 'Premier League', 'active', NOW() - INTERVAL '15 minutes', (SELECT id FROM users WHERE wallet_address='0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE market_id=2002);

-- NFL: Jets vs Bengals (active)
INSERT INTO markets (market_id, title, category, status, opened_at, admin_user_id)
SELECT 2003, 'Jets vs Bengals', 'NFL', 'active', NOW() - INTERVAL '5 minutes', (SELECT id FROM users WHERE wallet_address='0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE market_id=2003);

-- Closed market (recently closed)
INSERT INTO markets (market_id, title, category, status, opened_at, closed_at)
SELECT 2101, 'Heat vs Knicks', 'NBA', 'closed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '10 minutes'
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE market_id=2101);

-- Settled market (with winner)
INSERT INTO markets (market_id, title, category, status, opened_at, settled_at, winning_option)
SELECT 2102, 'Chelsea vs Tottenham', 'Premier League', 'settled', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '30 minutes', 1
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE market_id=2102);

-- Cancelled market
INSERT INTO markets (market_id, title, category, status, opened_at)
SELECT 2103, 'Patriots vs 49ers', 'NFL', 'cancelled', NOW() - INTERVAL '1 hour'
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE market_id=2103);

-- Market options (home/away moneyline) for active markets
-- 2001: Lakers (home=1), Celtics (away=2)
INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 2001, 1, 'Home', 185
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=2001 AND code=1);
INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 2001, 2, 'Away', 195
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=2001 AND code=2);

-- 2002: Man City (home=1), Arsenal (away=2)
INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 2002, 1, 'Home', 175
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=2002 AND code=1);
INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 2002, 2, 'Away', 205
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=2002 AND code=2);

-- 2003: Jets (home=1), Bengals (away=2)
INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 2003, 1, 'Home', 215
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=2003 AND code=1);
INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 2003, 2, 'Away', 185
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=2003 AND code=2);

-- Orders referencing users and active markets (respecting FK to market_options)
INSERT INTO orders (order_id, user_address, market_id, amount, odds, option, potential_payout, settled, claimed, tx_hash)
SELECT 920001, '0x1111111111111111111111111111111111111111', 2001, 1000000000, 185, 1, 1850000000, false, false, '0x' || repeat('A', 64)
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_id=920001);

INSERT INTO orders (order_id, user_address, market_id, amount, odds, option, potential_payout, settled, claimed, tx_hash)
SELECT 920002, '0x2222222222222222222222222222222222222222', 2002, 2000000000, 205, 2, 4100000000, false, false, '0x' || repeat('B', 64)
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_id=920002);

INSERT INTO orders (order_id, user_address, market_id, amount, odds, option, potential_payout, settled, claimed, tx_hash)
SELECT 920003, '0x1111111111111111111111111111111111111111', 2003, 1500000000, 215, 1, 3225000000, false, false, '0x' || repeat('C', 64)
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_id=920003);

-- Notes:
-- - amounts are NUMERIC (lamports-like integers for demo), odds are bps integers
-- - orders reference (market_id, option) existing pairs; ensure market_options inserted first
-- - active markets are used by GET /api/v1/markets/active and will be displayed by LiveInPlayGrid
-- - odds endpoint can compute moneyline from market_options if Redis cache is empty