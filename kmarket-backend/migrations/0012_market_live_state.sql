-- market_live_state: 实时比赛状态（用于 In-Play 展示）
CREATE TABLE IF NOT EXISTS market_live_state (
  market_id BIGINT PRIMARY KEY REFERENCES markets(market_id) ON DELETE CASCADE,
  is_live BOOLEAN NOT NULL DEFAULT true,
  phase VARCHAR(32) DEFAULT NULL,
  minute INTEGER DEFAULT NULL,
  second INTEGER DEFAULT NULL,
  period INTEGER DEFAULT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_market_live_state_live ON market_live_state(is_live);

-- Demo live states for seeded markets
INSERT INTO market_live_state (market_id, is_live, phase, minute, second, period, home_score, away_score)
SELECT 2001, true, 'Q4', 10, 45, 4, 102, 105
WHERE NOT EXISTS (SELECT 1 FROM market_live_state WHERE market_id=2001);

INSERT INTO market_live_state (market_id, is_live, phase, minute, second, period, home_score, away_score)
SELECT 2002, true, 'Second Half', 81, NULL, 2, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM market_live_state WHERE market_id=2002);

INSERT INTO market_live_state (market_id, is_live, phase, minute, second, period, home_score, away_score)
SELECT 2003, true, 'Q3', 4, 42, 3, 17, 21
WHERE NOT EXISTS (SELECT 1 FROM market_live_state WHERE market_id=2003);