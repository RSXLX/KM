-- Users, Markets, Orders schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    address         VARCHAR(64) UNIQUE NOT NULL, -- EVM/BSC address in hex
    username        VARCHAR(64),
    email           VARCHAR(255),
    password_hash   VARCHAR(255), -- store hashed password if applicable
    salt            VARCHAR(64),
    status          VARCHAR(32) DEFAULT 'active' NOT NULL,
    version         INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    id               BIGSERIAL PRIMARY KEY,
    market_id        BIGINT UNIQUE NOT NULL, -- business id (on-chain or external)
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    option_a         VARCHAR(128) NOT NULL,
    option_b         VARCHAR(128) NOT NULL,
    start_time       TIMESTAMPTZ NOT NULL,
    end_time         TIMESTAMPTZ NOT NULL,
    status           market_status NOT NULL DEFAULT 'pending',
    winning_option   SMALLINT, -- 0 or 1
    version          INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_market_time CHECK (end_time > start_time),
    CONSTRAINT chk_winning_option CHECK (winning_option IS NULL OR winning_option IN (0, 1))
);

-- Orders/Bets table
CREATE TABLE IF NOT EXISTS orders (
    id               BIGSERIAL PRIMARY KEY,
    order_id         BIGINT UNIQUE NOT NULL,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id        BIGINT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    amount           NUMERIC(38, 18) NOT NULL CHECK (amount > 0),
    odds             NUMERIC(18, 8) NOT NULL CHECK (odds > 0),
    option           SMALLINT NOT NULL CHECK (option IN (0, 1)),
    status           order_status NOT NULL DEFAULT 'placed',
    version          INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order audit (optional, created if not exists)
CREATE TABLE IF NOT EXISTS order_audits (
    id           BIGSERIAL PRIMARY KEY,
    order_id     BIGINT NOT NULL,
    action       VARCHAR(64) NOT NULL, -- created/cancelled/settled
    detail       JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers to update updated_at timestamps
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
        CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_set_updated_at') THEN
        CREATE TRIGGER users_set_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'markets_set_updated_at') THEN
        CREATE TRIGGER markets_set_updated_at
        BEFORE UPDATE ON markets
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_set_updated_at') THEN
        CREATE TRIGGER orders_set_updated_at
        BEFORE UPDATE ON orders
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
    END IF;
END$$;