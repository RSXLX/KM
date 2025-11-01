import type { TeamInfo, PlayerInfo, TeamStats, TeamDetails } from '@/types/sports';

// Mock team information - Manchester City
export const mockTeamInfo: TeamInfo = {
  id: 'team-001',
  name: 'Manchester City',
  shortName: 'MAN CITY',
  logo: '/logos/manchester-city.png',
  founded: 1880,
  stadium: 'Etihad Stadium',
  capacity: 55017,
  city: 'Manchester',
  country: 'England',
  league: 'Premier League',
  website: 'https://www.mancity.com',
  colors: {
    primary: '#6CABDD',
    secondary: '#1C2C5B'
  },
  achievements: [
    { type: 'Premier League', count: 9 },
    { type: 'FA Cup', count: 7 },
    { type: 'Champions League', count: 1 }
  ]
};

// Mock football players - Manchester City squad
export const mockPlayers: PlayerInfo[] = [
  {
    id: 'player-001',
    name: 'Erling Haaland',
    position: 'Forward',
    jerseyNumber: 9,
    age: 24,
    height: 194,
    weight: 88,
    nationality: 'Norway',
    marketValue: 180000000,
    contractUntil: '2027-06-30',
    stats: {
      appearances: 38,
      goals: 27,
      assists: 5,
      yellowCards: 4,
      redCards: 0,
      minutesPlayed: 2890
    }
  },
  {
    id: 'player-002',
    name: 'Kevin De Bruyne',
    position: 'Midfielder',
    jerseyNumber: 17,
    age: 33,
    height: 181,
    weight: 70,
    nationality: 'Belgium',
    marketValue: 80000000,
    contractUntil: '2025-06-30',
    stats: {
      appearances: 26,
      goals: 4,
      assists: 10,
      yellowCards: 2,
      redCards: 0,
      minutesPlayed: 1980
    }
  },
  {
    id: 'player-003',
    name: 'Rodri',
    position: 'Midfielder',
    jerseyNumber: 16,
    age: 28,
    height: 191,
    weight: 82,
    nationality: 'Spain',
    marketValue: 120000000,
    contractUntil: '2027-06-30',
    stats: {
      appearances: 34,
      goals: 8,
      assists: 9,
      yellowCards: 8,
      redCards: 0,
      minutesPlayed: 2856
    }
  },
  {
    id: 'player-004',
    name: 'Ruben Dias',
    position: 'Defender',
    jerseyNumber: 3,
    age: 27,
    height: 187,
    weight: 82,
    nationality: 'Portugal',
    marketValue: 80000000,
    contractUntil: '2027-06-30',
    stats: {
      appearances: 31,
      goals: 1,
      assists: 1,
      yellowCards: 5,
      redCards: 0,
      minutesPlayed: 2790
    }
  }
];

// Mock team statistics - Manchester City
export const mockTeamStats: TeamStats = {
  teamId: 'team-001',
  season: '2023-24',
  league: 'Premier League',
  position: 1,
  totalTeams: 20,
  gamesPlayed: 38,
  wins: 28,
  draws: 7,
  losses: 3,
  goalsFor: 96,
  goalsAgainst: 34,
  goalDifference: 62,
  points: 91,
  homeRecord: {
    played: 19,
    wins: 17,
    draws: 2,
    losses: 0,
    goalsFor: 57,
    goalsAgainst: 14
  },
  awayRecord: {
    played: 19,
    wins: 11,
    draws: 5,
    losses: 3,
    goalsFor: 39,
    goalsAgainst: 20
  },
  form: ['W', 'W', 'D', 'W', 'W'], // Last 5 matches
  topScorer: {
    playerId: 'player-001',
    name: 'Erling Haaland',
    goals: 27
  },
  topAssist: {
    playerId: 'player-002',
    name: 'Kevin De Bruyne',
    assists: 18
  },
  cleanSheets: 18,
  averageGoalsPerGame: 2.53,
  averageGoalsConcededPerGame: 0.89,
  possessionPercentage: 68.2,
  passAccuracy: 89.5,
  shotsPerGame: 16.8,
  shotsOnTargetPerGame: 6.4,
  cornersPerGame: 7.2,
  foulsPerGame: 9.8,
  yellowCards: 52,
  redCards: 2
};

// Mock basketball player - Los Angeles Lakers
export const mockBasketballPlayer: PlayerInfo = {
  id: 'player-101',
  name: 'LeBron James',
  position: 'Small Forward',
  jerseyNumber: 23,
  age: 39,
  height: 206,
  weight: 113,
  nationality: 'USA',
  marketValue: 50000000,
  contractUntil: '2025-06-30',
  stats: {
    appearances: 71,
    points: 25.7,
    rebounds: 7.3,
    assists: 8.3,
    steals: 1.3,
    blocks: 0.5,
    fieldGoalPercentage: 54.0,
    threePointPercentage: 41.0,
    freeThrowPercentage: 75.0,
    minutesPlayed: 35.3
  }
};

// Mock American football player - Kansas City Chiefs
export const mockFootballPlayer: PlayerInfo = {
  id: 'player-201',
  name: 'Patrick Mahomes',
  position: 'Quarterback',
  jerseyNumber: 15,
  age: 29,
  height: 188,
  weight: 104,
  nationality: 'USA',
  marketValue: 45000000,
  contractUntil: '2031-06-30',
  stats: {
    appearances: 17,
    passingYards: 4183,
    passingTouchdowns: 27,
    interceptions: 14,
    rushingYards: 389,
    rushingTouchdowns: 4,
    completionPercentage: 67.2,
    passerRating: 92.6,
    qbr: 61.8
  }
};

// Mock team details with complete information
export const mockTeamDetails: TeamDetails = {
  ...mockTeamInfo,
  players: mockPlayers,
  stats: mockTeamStats,
  recentMatches: [
    {
      id: 'match-001',
      date: '2024-05-19',
      opponent: 'West Ham United',
      isHome: true,
      result: 'W',
      score: '3-1',
      competition: 'Premier League'
    },
    {
      id: 'match-002',
      date: '2024-05-14',
      opponent: 'Tottenham Hotspur',
      isHome: false,
      result: 'W',
      score: '2-0',
      competition: 'Premier League'
    },
    {
      id: 'match-003',
      date: '2024-05-11',
      opponent: 'Fulham',
      isHome: true,
      result: 'W',
      score: '4-0',
      competition: 'Premier League'
    },
    {
      id: 'match-004',
      date: '2024-05-04',
      opponent: 'Wolverhampton',
      isHome: false,
      result: 'W',
      score: '5-1',
      competition: 'Premier League'
    },
    {
      id: 'match-005',
      date: '2024-04-25',
      opponent: 'Brighton',
      isHome: true,
      result: 'D',
      score: '4-0',
      competition: 'Premier League'
    }
  ],
  upcomingMatches: [
    {
      id: 'match-101',
      date: '2024-08-18',
      opponent: 'Chelsea',
      isHome: false,
      competition: 'Premier League',
      time: '16:30'
    },
    {
      id: 'match-102',
      date: '2024-08-24',
      opponent: 'Newcastle United',
      isHome: true,
      competition: 'Premier League',
      time: '15:00'
    },
    {
      id: 'match-103',
      date: '2024-08-31',
      opponent: 'Arsenal',
      isHome: false,
      competition: 'Premier League',
      time: '17:30'
    }
  ],
  leagueStanding: {
    position: 1,
    points: 91,
    gamesPlayed: 38,
    wins: 28,
    draws: 7,
    losses: 3,
    goalsFor: 96,
    goalsAgainst: 34,
    goalDifference: 62
  }
};