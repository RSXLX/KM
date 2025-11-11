-- Create carousel_items table to replace JSON storage
CREATE TABLE IF NOT EXISTS carousel_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  image_url TEXT NOT NULL,
  href TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carousel_items_order ON carousel_items("order");