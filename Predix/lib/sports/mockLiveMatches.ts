import type { LiveMatch } from '@/components/sports/LiveMatchCard';

export const mockLiveMatches: LiveMatch[] = [
  {
    id: 'match-001',
    sport: 'Football',
    teams: {
      home: { name: 'Manchester City', score: 2, code: 'MCI' },
      away: { name: 'Arsenal', score: 1, code: 'ARS' }
    },
    status: { 
      time: "78'", 
      isLive: true, 
      phase: 'Second Half',
      minute: 78,
      period: 2
    },
    liveOdds: { 
      home: 1.85, 
      draw: 3.20, 
      away: 4.50,
      lastUpdated: Date.now(),
      trend: 'down'
    },
    marketUrl: '/football/match-001',
    startTime: '2024-01-20T15:00:00Z',
    venue: 'Etihad Stadium',
    league: 'Premier League',
    attendance: 55000,
    temperature: 12,
    weather: 'Clear'
  },
  {
    id: 'match-002',
    sport: 'Basketball',
    teams: {
      home: { name: 'Los Angeles Lakers', score: 98, code: 'LAL' },
      away: { name: 'Golden State Warriors', score: 102, code: 'GSW' }
    },
    status: { 
      time: 'Q4 03:45', 
      isLive: true, 
      phase: 'Fourth Quarter',
      minute: 8,
      second: 15,
      period: 4
    },
    liveOdds: { 
      home: 2.10, 
      away: 1.75,
      lastUpdated: Date.now(),
      trend: 'up'
    },
    marketUrl: '/basketball/match-002',
    startTime: '2024-01-20T20:00:00Z',
    venue: 'Crypto.com Arena',
    league: 'NBA',
    attendance: 20000,
    temperature: 22,
    weather: 'Indoor'
  },
  {
    id: 'match-003',
    sport: 'American Football',
    teams: {
      home: { name: 'Kansas City Chiefs', score: 21, code: 'KC' },
      away: { name: 'New England Patriots', score: 14, code: 'NE' }
    },
    status: { 
      time: 'Q3 08:32', 
      isLive: true, 
      phase: 'Third Quarter',
      minute: 6,
      second: 28,
      period: 3
    },
    liveOdds: { 
      home: 1.65, 
      away: 2.25,
      lastUpdated: Date.now(),
      trend: 'stable'
    },
    marketUrl: '/american-football/match-003',
    startTime: '2024-01-20T18:00:00Z',
    venue: 'Arrowhead Stadium',
    league: 'NFL',
    attendance: 76000,
    temperature: 5,
    weather: 'Cloudy'
  },
  {
    id: 'match-004',
    sport: 'Football',
    teams: {
      home: { name: 'FC Barcelona', score: 0, code: 'BAR' },
      away: { name: 'Real Madrid', score: 0, code: 'RMA' }
    },
    status: { 
      time: "23'", 
      isLive: true, 
      phase: 'First Half',
      minute: 23,
      period: 1
    },
    liveOdds: { 
      home: 2.45, 
      draw: 3.10, 
      away: 2.65,
      lastUpdated: Date.now(),
      trend: 'up'
    },
    marketUrl: '/football/match-004',
    startTime: '2024-01-20T21:00:00Z',
    venue: 'Camp Nou',
    league: 'La Liga',
    attendance: 99000,
    temperature: 18,
    weather: 'Clear'
  },
  {
    id: 'match-005',
    sport: 'Basketball',
    teams: {
      home: { name: 'Miami Heat', score: 67, code: 'MIA' },
      away: { name: 'Los Angeles Lakers', score: 72, code: 'LAL' }
    },
    status: { 
      time: 'Q3 06:12', 
      isLive: true, 
      phase: 'Third Quarter',
      minute: 5,
      second: 48,
      period: 3
    },
    liveOdds: { 
      home: 1.95, 
      away: 1.90,
      lastUpdated: Date.now(),
      trend: 'down'
    },
    marketUrl: '/basketball/match-005',
    startTime: '2024-01-20T19:30:00Z',
    venue: 'Kaseya Center',
    league: 'NBA',
    attendance: 19600,
    temperature: 24,
    weather: 'Indoor'
  },
  {
    id: 'match-006',
    sport: 'American Football',
    teams: {
      home: { name: 'Dallas Cowboys', score: 7, code: 'DAL' },
      away: { name: 'Green Bay Packers', score: 10, code: 'GB' }
    },
    status: { 
      time: 'Q2 02:15', 
      isLive: true, 
      phase: 'Second Quarter',
      minute: 12,
      second: 45,
      period: 2
    },
    liveOdds: { 
      home: 2.05, 
      away: 1.80,
      lastUpdated: Date.now(),
      trend: 'stable'
    },
    marketUrl: '/american-football/match-006',
    startTime: '2024-01-20T16:25:00Z',
    venue: 'AT&T Stadium',
    league: 'NFL',
    attendance: 80000,
    temperature: 8,
    weather: 'Indoor'
  },
  // 添加一些非live状态的比赛用于测试
  {
    id: 'match-007',
    sport: 'Football',
    teams: {
      home: { name: 'Liverpool', score: 3, code: 'LIV' },
      away: { name: 'Chelsea', score: 1, code: 'CHE' }
    },
    status: { 
      time: "90'", 
      isLive: false, 
      phase: 'Full Time',
      finished: true,
      minute: 90,
      period: 2
    },
    liveOdds: { 
      home: 1.45, 
      draw: 4.20, 
      away: 6.50,
      lastUpdated: Date.now() - 300000, // 5分钟前
      trend: 'stable'
    },
    marketUrl: '/football/match-007',
    startTime: '2024-01-20T14:00:00Z',
    venue: 'Anfield',
    league: 'Premier League',
    attendance: 54000,
    temperature: 10,
    weather: 'Rainy'
  },
  {
    id: 'match-008',
    sport: 'Basketball',
    teams: {
      home: { name: 'Boston Celtics', score: 0, code: 'BOS' },
      away: { name: 'Miami Heat', score: 0, code: 'MIA' }
    },
    status: { 
      time: '20:00', 
      isLive: false, 
      phase: 'Scheduled'
    },
    liveOdds: { 
      home: 1.75, 
      away: 2.10,
      lastUpdated: Date.now() - 3600000, // 1小时前
      trend: 'up'
    },
    marketUrl: '/basketball/match-008',
    startTime: '2024-01-21T01:00:00Z',
    venue: 'TD Garden',
    league: 'NBA',
    temperature: 20,
    weather: 'Indoor'
  },
  {
    id: 'match-009',
    sport: 'Football',
    teams: {
      home: { name: 'Tottenham', score: 1, code: 'TOT' },
      away: { name: 'Newcastle', score: 1, code: 'NEW' }
    },
    status: { 
      time: "45'", 
      isLive: false, 
      phase: 'Half Time',
      halftime: true,
      minute: 45,
      period: 1
    },
    liveOdds: { 
      home: 2.20, 
      draw: 3.40, 
      away: 3.10,
      lastUpdated: Date.now() - 900000, // 15分钟前
      trend: 'down'
    },
    marketUrl: '/football/match-009',
    startTime: '2024-01-20T17:30:00Z',
    venue: 'Tottenham Hotspur Stadium',
    league: 'Premier League',
    attendance: 62000,
    temperature: 9,
    weather: 'Overcast'
  }
];

export function getMockLiveMatchById(id: string): LiveMatch | undefined {
  return mockLiveMatches.find(match => match.id === id);
}

export function getMockLiveMatchesBySport(sport: string): LiveMatch[] {
  return mockLiveMatches.filter(match => 
    match.sport.toLowerCase() === sport.toLowerCase()
  );
}