import { LiveMatch } from '@/components/sports/LiveMatchCard';

// 专门用于 preGame 状态的静态数据
export const mockPreGameMatches: LiveMatch[] = [
  {
    id: 'pre-epl-001',
    sport: 'Premier League',
    teams: {
      home: { name: 'Manchester United', score: 0, code: 'MUN' },
      away: { name: 'Liverpool', score: 0, code: 'LIV' },
    },
    status: { 
      time: '15:00', 
      isLive: false,
      phase: 'Scheduled',
      finished: false
    },
    liveOdds: { 
      home: 2.8, 
      draw: 3.2, 
      away: 2.4,
      lastUpdated: Date.now(),
      trend: 'stable'
    },
    marketUrl: '/sports-betting',
    startTime: '2024-01-21T15:00:00Z',
    venue: 'Old Trafford',
    league: 'Premier League'
  },
  {
    id: 'pre-nba-002',
    sport: 'NBA',
    teams: {
      home: { name: 'Warriors', score: 0, code: 'GSW' },
      away: { name: 'Lakers', score: 0, code: 'LAL' },
    },
    status: { 
      time: '22:00', 
      isLive: false,
      phase: 'Scheduled',
      finished: false
    },
    liveOdds: { 
      home: 1.9, 
      away: 1.9,
      lastUpdated: Date.now(),
      trend: 'stable'
    },
    marketUrl: '/sports-betting',
    startTime: '2024-01-21T22:00:00Z',
    venue: 'Chase Center',
    league: 'NBA'
  },
  {
    id: 'pre-laliga-003',
    sport: 'La Liga',
    teams: {
      home: { name: 'Real Madrid', score: 0, code: 'RMA' },
      away: { name: 'Barcelona', score: 0, code: 'FCB' },
    },
    status: { 
      time: '21:00', 
      isLive: false,
      phase: 'Scheduled',
      finished: false
    },
    liveOdds: { 
      home: 2.1, 
      draw: 3.4, 
      away: 3.2,
      lastUpdated: Date.now(),
      trend: 'stable'
    },
    marketUrl: '/sports-betting',
    startTime: '2024-01-21T21:00:00Z',
    venue: 'Santiago Bernabéu',
    league: 'La Liga'
  },
  {
    id: 'pre-nfl-004',
    sport: 'NFL',
    teams: {
      home: { name: 'Chiefs', score: 0, code: 'KC' },
      away: { name: 'Bills', score: 0, code: 'BUF' },
    },
    status: { 
      time: '20:20', 
      isLive: false,
      phase: 'Scheduled',
      finished: false
    },
    liveOdds: { 
      home: 1.8, 
      away: 2.0,
      lastUpdated: Date.now(),
      trend: 'stable'
    },
    marketUrl: '/sports-betting',
    startTime: '2024-01-21T20:20:00Z',
    venue: 'Arrowhead Stadium',
    league: 'NFL'
  },
  {
    id: 'pre-serie-005',
    sport: 'Serie A',
    teams: {
      home: { name: 'Juventus', score: 0, code: 'JUV' },
      away: { name: 'AC Milan', score: 0, code: 'MIL' },
    },
    status: { 
      time: '18:45', 
      isLive: false,
      phase: 'Scheduled',
      finished: false
    },
    liveOdds: { 
      home: 2.3, 
      draw: 3.1, 
      away: 2.9,
      lastUpdated: Date.now(),
      trend: 'stable'
    },
    marketUrl: '/sports-betting',
    startTime: '2024-01-21T18:45:00Z',
    venue: 'Allianz Stadium',
    league: 'Serie A'
  }
];