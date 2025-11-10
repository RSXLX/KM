-- Add blacklist/whitelist flags to users for admin control

ALTER TABLE users ADD COLUMN IF NOT EXISTS blacklisted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whitelisted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_blacklisted ON users(blacklisted);
CREATE INDEX IF NOT EXISTS idx_users_whitelisted ON users(whitelisted);