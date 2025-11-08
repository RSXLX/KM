-- 初始种子数据（演示用）
-- 用户
INSERT INTO users (wallet_address, display_name, role)
SELECT '0x1111111111111111111111111111111111111111','Alice','admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE wallet_address='0x1111111111111111111111111111111111111111');

INSERT INTO users (wallet_address, display_name, role)
SELECT '0x2222222222222222222222222222222222222222','Bob','user'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE wallet_address='0x2222222222222222222222222222222222222222');

-- 市场
INSERT INTO markets (market_id, title, category, status, admin_user_id)
SELECT 1001, 'Demo Market A', 'general', 'active', (SELECT id FROM users WHERE wallet_address='0x1111111111111111111111111111111111111111')
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE market_id=1001);

INSERT INTO markets (market_id, title, category, status)
SELECT 1002, 'Demo Market B', 'sports', 'draft'
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE market_id=1002);

-- 市场选项
INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 1001, 0, 'Option A', 150
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=1001 AND code=0);
INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 1001, 1, 'Option B', 180
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=1001 AND code=1);

INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 1002, 0, 'Home', 200
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=1002 AND code=0);
INSERT INTO market_options (market_id, code, label, initial_odds)
SELECT 1002, 1, 'Away', 200
WHERE NOT EXISTS (SELECT 1 FROM market_options WHERE market_id=1002 AND code=1);

-- 示例订单
INSERT INTO orders (order_id, user_address, market_id, amount, odds, option, potential_payout, settled, claimed)
SELECT 900001, '0x2222222222222222222222222222222222222222', 1001, 1000, 150, 0, 1500, false, false
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_id=900001);