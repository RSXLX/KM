export type MockFixture = {
  id: string;
  title: string;
  sport: 'NBA' | 'NFL' | 'Premier League' | 'UCL' | 'MLB' | 'Tennis' | string;
  league?: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string; // e.g. "2025-10-26T19:30:00Z" or human-readable
  status?: 'pre' | 'live' | 'final';
  preOdds?: { home: number; away: number; draw?: number };
  liveOdds?: { home: number; away: number; draw?: number };
};

export const mockFixtures: MockFixture[] = [
  {
    id: 'nba-lal-bos-001',
    title: 'NBA • Los Angeles Lakers vs Boston Celtics',
    sport: 'NBA',
    league: 'NBA',
    homeTeam: 'Los Angeles Lakers',
    awayTeam: 'Boston Celtics',
    kickoffTime: 'Today 19:30',
    status: 'pre',
    preOdds: { home: 1.82, away: 2.05 }
  },
  {
    id: 'epl-mci-ars-002',
    title: 'Premier League • Manchester City vs Arsenal',
    sport: 'Premier League',
    league: 'EPL',
    homeTeam: 'Manchester City',
    awayTeam: 'Arsenal',
    kickoffTime: 'Today 21:00',
    status: 'pre',
    preOdds: { home: 2.10, draw: 3.20, away: 2.45 }
  },
  {
    id: 'nfl-nyj-cin-003',
    title: 'NFL • New York Jets vs Cincinnati Bengals',
    sport: 'NFL',
    league: 'NFL',
    homeTeam: 'New York Jets',
    awayTeam: 'Cincinnati Bengals',
    kickoffTime: 'Sun 13:00',
    status: 'pre',
    preOdds: { home: 1.95, away: 1.90 }
  },
  {
    id: 'ucl-rma-bar-004',
    title: 'UEFA Champions League • Real Madrid vs Barcelona',
    sport: 'UCL',
    league: 'UEFA Champions League',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    kickoffTime: 'Wed 20:45',
    status: 'pre',
    preOdds: { home: 2.35, draw: 3.10, away: 2.65 }
  },
  {
    id: 'mlb-nyy-bos-005',
    title: 'MLB • New York Yankees vs Boston Red Sox',
    sport: 'MLB',
    league: 'MLB',
    homeTeam: 'New York Yankees',
    awayTeam: 'Boston Red Sox',
    kickoffTime: 'Fri 18:00',
    status: 'pre',
    preOdds: { home: 1.88, away: 2.02 }
  },
  {
    id: 'tennis-djoko-nadal-006',
    title: 'Tennis • Novak Djokovic vs Rafael Nadal',
    sport: 'Tennis',
    league: 'ATP',
    homeTeam: 'Novak Djokovic',
    awayTeam: 'Rafael Nadal',
    kickoffTime: 'Sat 16:00',
    status: 'pre',
    preOdds: { home: 1.75, away: 2.20 }
  },
  // Live fixtures (isLive=true)
  {
    id: 'nba-phi-mia-live-101',
    title: 'NBA • Philadelphia 76ers vs Miami Heat',
    sport: 'NBA',
    league: 'NBA',
    homeTeam: 'Philadelphia 76ers',
    awayTeam: 'Miami Heat',
    kickoffTime: 'Q3 05:12',
    status: 'live',
    liveOdds: { home: 2.10, away: 1.80 }
  },
  {
    id: 'epl-liv-mun-live-102',
    title: 'Premier League • Liverpool vs Manchester United',
    sport: 'Premier League',
    league: 'EPL',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester United',
    kickoffTime: "78'",
    status: 'live',
    liveOdds: { home: 2.45, draw: 3.05, away: 2.35 }
  },
  {
    id: 'nfl-dal-sf-live-103',
    title: 'NFL • Dallas Cowboys vs San Francisco 49ers',
    sport: 'NFL',
    league: 'NFL',
    homeTeam: 'Dallas Cowboys',
    awayTeam: 'San Francisco 49ers',
    kickoffTime: 'Q4 03:28',
    status: 'live',
    liveOdds: { home: 2.85, away: 1.55 }
  }
];

export function getFixtureById(id: string): MockFixture | undefined {
  return mockFixtures.find(f => f.id === id);
}