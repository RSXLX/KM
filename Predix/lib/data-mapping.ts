import type { BackendActiveMarket, BackendOddsQuote } from '@/types/backend';
import type { LiveMatch } from '@/components/sports/LiveMatchCard';

export function fromActiveToLiveMatch(it: BackendActiveMarket): LiveMatch {
  const [homeNameRaw, awayNameRaw] = String(it.title || 'Home vs Away').split(/\s+vs\s+/i);
  const homeName = (homeNameRaw || 'Home').trim();
  const awayName = (awayNameRaw || 'Away').trim();
  return {
    id: String(it.market_id),
    sport: it.category || 'Sports',
    teams: { home: { name: homeName }, away: { name: awayName } },
    status: { isLive: true, time: 'Live' },
    marketUrl: `/sports-betting?fixtureId=${it.market_id}`,
    league: it.category || 'Sports',
  } as LiveMatch;
}

export function normalizeOdds(resp: BackendOddsQuote) {
  const moneyline = resp?.moneyline;
  const home = typeof moneyline?.home === 'number' ? moneyline.home : (typeof resp?.odds_a === 'number' ? resp.odds_a / 100 : undefined);
  const away = typeof moneyline?.away === 'number' ? moneyline.away : (typeof resp?.odds_b === 'number' ? resp.odds_b / 100 : undefined);
  return { home, away, spread: resp?.spread ?? null, total: resp?.total ?? null, timestamp: resp?.timestamp, source: resp?.source };
}