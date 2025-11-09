-- Align sequences with current max IDs to avoid duplicate key errors
SELECT setval(pg_get_serial_sequence('users','id'), COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('markets','id'), COALESCE((SELECT MAX(id) FROM markets), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('orders','id'), COALESCE((SELECT MAX(id) FROM orders), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('order_audits','id'), COALESCE((SELECT MAX(id) FROM order_audits), 0) + 1, false);