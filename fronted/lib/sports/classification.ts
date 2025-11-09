import type { MockFixture } from './mockFixtures';

export type Classification = {
  sport: string;
  league?: string;
  matchup: string; // e.g. "Lakers vs Celtics"
  status?: 'pre' | 'live' | 'final';
};

// 关键词映射，可按需扩展
const SPORT_KEYWORDS: Record<string, string> = {
  nba: 'NBA',
  nfl: 'NFL',
  'premier league': 'Premier League',
  epl: 'Premier League',
  ucl: 'UCL',
  mlb: 'MLB',
  tennis: 'Tennis'
};

const LEAGUE_KEYWORDS: Record<string, string> = {
  nba: 'NBA',
  nfl: 'NFL',
  epl: 'EPL',
  'premier league': 'EPL',
  ucl: 'UEFA Champions League',
  mlb: 'MLB',
  atp: 'ATP'
};

export function classifyFixtureTitle(title: string, fallbackSport?: string): { sport: string; league?: string } {
  const t = title.toLowerCase();
  let sport = fallbackSport || 'Other';
  let league: string | undefined;

  for (const [key, val] of Object.entries(SPORT_KEYWORDS)) {
    if (t.includes(key)) {
      sport = val;
      break;
    }
  }
  for (const [key, val] of Object.entries(LEAGUE_KEYWORDS)) {
    if (t.includes(key)) {
      league = val;
      break;
    }
  }
  return { sport, league };
}

export function toMatchup(home: string, away: string): string {
  return `${home} vs ${away}`;
}

export function enrichFixture(f: MockFixture): Classification {
  const { sport, league } = classifyFixtureTitle(f.title, f.sport);
  return {
    sport,
    league,
    matchup: toMatchup(f.homeTeam, f.awayTeam),
    status: f.status || 'pre'
  };
}