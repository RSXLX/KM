-- ENUM 类型：市场状态
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_status') THEN
    CREATE TYPE market_status AS ENUM ('draft','active','closed','settled','cancelled');
  END IF;
END $$;