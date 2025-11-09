-- Create enum types with idempotent guards
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_status') THEN
        CREATE TYPE market_status AS ENUM ('pending', 'active', 'settled', 'cancelled');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('placed', 'cancelled', 'settled');
    END IF;
END$$;

-- Simple option check will be used instead of enum for bet option