-- Replace sports_fixtures_v to align with simulation requirements
-- Classification rules:
-- - Active → live (regardless of start_time/end_time)
-- - Pending → pre
-- - Settled/Cancelled → final
-- - Else → pre

DROP VIEW IF EXISTS sports_fixtures_v;
CREATE VIEW sports_fixtures_v AS
SELECT 
    m.market_id,
    (m.market_id)::TEXT AS id,
    COALESCE(m.title, 'Fixture'::varchar) AS title,
    CASE 
        WHEN m.title ILIKE '%NBA%' THEN 'NBA'
        WHEN m.title ILIKE '%NFL%' THEN 'NFL'
        WHEN m.title ILIKE '%Premier%' OR m.title ILIKE '%EPL%' THEN 'Premier League'
        WHEN m.title ILIKE '%MLB%' THEN 'MLB'
        WHEN m.title ILIKE '%UCL%' OR m.title ILIKE '%UEFA%' THEN 'UCL'
        WHEN m.title ILIKE '%Tennis%' THEN 'Tennis'
        ELSE 'Sports'
    END AS sport,
    CASE 
        WHEN m.title ILIKE '%EPL%' OR m.title ILIKE '%Premier%' THEN 'EPL'
        WHEN m.title ILIKE '%UEFA%' OR m.title ILIKE '%UCL%' THEN 'UEFA Champions League'
        ELSE NULL
    END AS league,
    COALESCE(NULLIF(m.home_name, ''), m.option_a, 'Home') AS home_team,
    COALESCE(NULLIF(m.away_name, ''), m.option_b, 'Away') AS away_team,
    m.start_time AS kickoff_time,
    CASE 
        WHEN m.status = 'active' THEN 'live'
        WHEN m.status = 'pending' THEN 'pre'
        WHEN m.status IN ('settled', 'cancelled') THEN 'final'
        ELSE 'pre'
    END AS status,
    jsonb_build_object(
        'home', COALESCE(m.odds_home_bps, 0)::numeric / 10000.0,
        'away', COALESCE(m.odds_away_bps, 0)::numeric / 10000.0
    ) AS pre_odds,
    jsonb_build_object(
        'home', COALESCE(m.odds_home_bps, 0)::numeric / 10000.0,
        'away', COALESCE(m.odds_away_bps, 0)::numeric / 10000.0
    ) AS live_odds
FROM markets m
WHERE m.status IN ('active', 'pending', 'settled', 'cancelled');