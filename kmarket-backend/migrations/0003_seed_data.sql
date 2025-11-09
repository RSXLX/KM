-- Seed basic demo data (idempotent insert using ON CONFLICT)

-- Seed one demo user
INSERT INTO users (id, address, username, email, password_hash, salt, status)
VALUES (1, '0x0000000000000000000000000000000000000001', 'demo', 'demo@kmarket.local', '$2y$demo', 'salt', 'active')
ON CONFLICT (id) DO NOTHING;

-- Seed a demo market
INSERT INTO markets (id, market_id, title, description, option_a, option_b, start_time, end_time, status)
VALUES (
    1,
    1001,
    'Demo Market',
    'Which side wins?',
    'Option A',
    'Option B',
    NOW(),
    NOW() + INTERVAL '1 day',
    'active'
)
ON CONFLICT (id) DO NOTHING;

-- Seed a demo order
INSERT INTO orders (id, order_id, user_id, market_id, amount, odds, option, status)
VALUES (1, 5001, 1, 1, 10.000000000000000000, 1.85000000, 0, 'placed')
ON CONFLICT (id) DO NOTHING;