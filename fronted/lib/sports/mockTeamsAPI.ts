import type { TeamInfo, PlayerInfo, TeamStats, TeamDetails } from '@/types/sports';

// Sport types
export type SportType = 'football' | 'basketball' | 'american-football';

// Team database interface
export interface TeamDatabase {
  [teamId: string]: TeamDetails;
}

// Mock API interface
export interface MockTeamsAPI {
  getTeamById(teamId: string): TeamDetails | null;
  getTeamsBySport(sport: SportType): TeamDetails[];
  getAllTeams(): TeamDetails[];
  getRandomTeam(sport?: SportType): TeamDetails;
}

// Football Teams Data (Premier League, La Liga, Serie A, Bundesliga)
const footballTeams: TeamDatabase = {
  // Premier League
  'man-city': {
    id: 'man-city',
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
    colors: { primary: '#6CABDD', secondary: '#1C2C5B' },
    achievements: [
      { type: 'Premier League', count: 9 },
      { type: 'FA Cup', count: 7 },
      { type: 'Champions League', count: 1 }
    ],
    players: [
      {
        id: 'haaland-001',
        name: 'Erling Haaland',
        position: 'Forward',
        jerseyNumber: 9,
        age: 24,
        height: 194,
        weight: 88,
        nationality: 'Norway',
        marketValue: 180000000,
        contractUntil: '2027-06-30',
        stats: { appearances: 38, goals: 27, assists: 5, yellowCards: 4, redCards: 0, minutesPlayed: 2890 }
      },
      {
        id: 'debruyne-001',
        name: 'Kevin De Bruyne',
        position: 'Midfielder',
        jerseyNumber: 17,
        age: 33,
        height: 181,
        weight: 70,
        nationality: 'Belgium',
        marketValue: 80000000,
        contractUntil: '2025-06-30',
        stats: { appearances: 26, goals: 4, assists: 10, yellowCards: 2, redCards: 0, minutesPlayed: 1980 }
      }
    ],
    stats: {
      teamId: 'man-city',
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
      homeRecord: { played: 19, wins: 17, draws: 2, losses: 0, goalsFor: 57, goalsAgainst: 14 },
      awayRecord: { played: 19, wins: 11, draws: 5, losses: 3, goalsFor: 39, goalsAgainst: 20 },
      form: ['W', 'W', 'D', 'W', 'W'],
      topScorer: { playerId: 'haaland-001', name: 'Erling Haaland', goals: 27 },
      topAssist: { playerId: 'debruyne-001', name: 'Kevin De Bruyne', assists: 18 },
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
    },
    recentMatches: [
      { id: 'match-001', date: '2024-05-19', opponent: 'West Ham United', isHome: true, result: 'W', score: '3-1', competition: 'Premier League' },
      { id: 'match-002', date: '2024-05-14', opponent: 'Tottenham Hotspur', isHome: false, result: 'W', score: '2-0', competition: 'Premier League' }
    ],
    upcomingMatches: [
      { id: 'match-101', date: '2024-08-18', opponent: 'Chelsea', isHome: false, competition: 'Premier League', time: '16:30' },
      { id: 'match-102', date: '2024-08-24', opponent: 'Newcastle United', isHome: true, competition: 'Premier League', time: '15:00' }
    ],
    leagueStanding: { position: 1, points: 91, gamesPlayed: 38, wins: 28, draws: 7, losses: 3, goalsFor: 96, goalsAgainst: 34, goalDifference: 62 }
  },

  'arsenal': {
    id: 'arsenal',
    name: 'Arsenal',
    shortName: 'ARS',
    logo: '/logos/arsenal.png',
    founded: 1886,
    stadium: 'Emirates Stadium',
    capacity: 60704,
    city: 'London',
    country: 'England',
    league: 'Premier League',
    website: 'https://www.arsenal.com',
    colors: { primary: '#EF0107', secondary: '#023474' },
    achievements: [
      { type: 'Premier League', count: 13 },
      { type: 'FA Cup', count: 14 },
      { type: 'Champions League', count: 0 }
    ],
    players: [
      {
        id: 'saka-001',
        name: 'Bukayo Saka',
        position: 'Winger',
        jerseyNumber: 7,
        age: 23,
        height: 178,
        weight: 70,
        nationality: 'England',
        marketValue: 120000000,
        contractUntil: '2027-06-30',
        stats: { appearances: 35, goals: 14, assists: 9, yellowCards: 3, redCards: 0, minutesPlayed: 2890 }
      },
      {
        id: 'odegaard-001',
        name: 'Martin Ødegaard',
        position: 'Midfielder',
        jerseyNumber: 8,
        age: 25,
        height: 178,
        weight: 68,
        nationality: 'Norway',
        marketValue: 100000000,
        contractUntil: '2028-06-30',
        stats: { appearances: 32, goals: 8, assists: 10, yellowCards: 4, redCards: 0, minutesPlayed: 2650 }
      }
    ],
    stats: {
      teamId: 'arsenal',
      season: '2023-24',
      league: 'Premier League',
      position: 2,
      totalTeams: 20,
      gamesPlayed: 38,
      wins: 28,
      draws: 5,
      losses: 5,
      goalsFor: 91,
      goalsAgainst: 29,
      goalDifference: 62,
      points: 89,
      homeRecord: { played: 19, wins: 16, draws: 2, losses: 1, goalsFor: 52, goalsAgainst: 12 },
      awayRecord: { played: 19, wins: 12, draws: 3, losses: 4, goalsFor: 39, goalsAgainst: 17 },
      form: ['W', 'W', 'L', 'W', 'D'],
      topScorer: { playerId: 'saka-001', name: 'Bukayo Saka', goals: 14 },
      topAssist: { playerId: 'odegaard-001', name: 'Martin Ødegaard', assists: 10 },
      cleanSheets: 16,
      averageGoalsPerGame: 2.39,
      averageGoalsConcededPerGame: 0.76,
      possessionPercentage: 63.8,
      passAccuracy: 87.2,
      shotsPerGame: 15.4,
      shotsOnTargetPerGame: 5.8,
      cornersPerGame: 6.8,
      foulsPerGame: 10.2,
      yellowCards: 58,
      redCards: 3
    },
    recentMatches: [
      { id: 'match-003', date: '2024-05-19', opponent: 'Everton', isHome: true, result: 'W', score: '2-1', competition: 'Premier League' },
      { id: 'match-004', date: '2024-05-14', opponent: 'Brighton', isHome: false, result: 'W', score: '3-0', competition: 'Premier League' }
    ],
    upcomingMatches: [
      { id: 'match-103', date: '2024-08-17', opponent: 'Wolves', isHome: true, competition: 'Premier League', time: '15:00' },
      { id: 'match-104', date: '2024-08-24', opponent: 'Aston Villa', isHome: false, competition: 'Premier League', time: '17:30' }
    ],
    leagueStanding: { position: 2, points: 89, gamesPlayed: 38, wins: 28, draws: 5, losses: 5, goalsFor: 91, goalsAgainst: 29, goalDifference: 62 }
  },

  // La Liga
  'real-madrid': {
    id: 'real-madrid',
    name: 'Real Madrid',
    shortName: 'RMA',
    logo: '/logos/real-madrid.png',
    founded: 1902,
    stadium: 'Santiago Bernabéu',
    capacity: 81044,
    city: 'Madrid',
    country: 'Spain',
    league: 'La Liga',
    website: 'https://www.realmadrid.com',
    colors: { primary: '#FFFFFF', secondary: '#FFC72C' },
    achievements: [
      { type: 'La Liga', count: 36 },
      { type: 'Copa del Rey', count: 20 },
      { type: 'Champions League', count: 15 }
    ],
    players: [
      {
        id: 'mbappe-001',
        name: 'Kylian Mbappé',
        position: 'Forward',
        jerseyNumber: 9,
        age: 25,
        height: 178,
        weight: 73,
        nationality: 'France',
        marketValue: 180000000,
        contractUntil: '2029-06-30',
        stats: { appearances: 15, goals: 8, assists: 2, yellowCards: 1, redCards: 0, minutesPlayed: 1200 }
      },
      {
        id: 'bellingham-001',
        name: 'Jude Bellingham',
        position: 'Midfielder',
        jerseyNumber: 5,
        age: 21,
        height: 186,
        weight: 75,
        nationality: 'England',
        marketValue: 150000000,
        contractUntil: '2029-06-30',
        stats: { appearances: 28, goals: 19, assists: 6, yellowCards: 5, redCards: 0, minutesPlayed: 2380 }
      }
    ],
    stats: {
      teamId: 'real-madrid',
      season: '2023-24',
      league: 'La Liga',
      position: 1,
      totalTeams: 20,
      gamesPlayed: 38,
      wins: 29,
      draws: 8,
      losses: 1,
      goalsFor: 87,
      goalsAgainst: 26,
      goalDifference: 61,
      points: 95,
      homeRecord: { played: 19, wins: 16, draws: 3, losses: 0, goalsFor: 48, goalsAgainst: 11 },
      awayRecord: { played: 19, wins: 13, draws: 5, losses: 1, goalsFor: 39, goalsAgainst: 15 },
      form: ['W', 'W', 'W', 'D', 'W'],
      topScorer: { playerId: 'bellingham-001', name: 'Jude Bellingham', goals: 19 },
      topAssist: { playerId: 'mbappe-001', name: 'Kylian Mbappé', assists: 8 },
      cleanSheets: 20,
      averageGoalsPerGame: 2.29,
      averageGoalsConcededPerGame: 0.68,
      possessionPercentage: 64.5,
      passAccuracy: 88.7,
      shotsPerGame: 14.2,
      shotsOnTargetPerGame: 5.6,
      cornersPerGame: 6.4,
      foulsPerGame: 11.8,
      yellowCards: 62,
      redCards: 4
    },
    recentMatches: [
      { id: 'match-005', date: '2024-05-25', opponent: 'Real Betis', isHome: true, result: 'W', score: '2-0', competition: 'La Liga' },
      { id: 'match-006', date: '2024-05-21', opponent: 'Villarreal', isHome: false, result: 'W', score: '4-1', competition: 'La Liga' }
    ],
    upcomingMatches: [
      { id: 'match-105', date: '2024-08-18', opponent: 'Mallorca', isHome: false, competition: 'La Liga', time: '22:00' },
      { id: 'match-106', date: '2024-08-25', opponent: 'Valladolid', isHome: true, competition: 'La Liga', time: '21:30' }
    ],
    leagueStanding: { position: 1, points: 95, gamesPlayed: 38, wins: 29, draws: 8, losses: 1, goalsFor: 87, goalsAgainst: 26, goalDifference: 61 }
  },

  'barcelona': {
    id: 'barcelona',
    name: 'FC Barcelona',
    shortName: 'BAR',
    logo: '/logos/barcelona.png',
    founded: 1899,
    stadium: 'Camp Nou',
    capacity: 99354,
    city: 'Barcelona',
    country: 'Spain',
    league: 'La Liga',
    website: 'https://www.fcbarcelona.com',
    colors: { primary: '#A50044', secondary: '#004D98' },
    achievements: [
      { type: 'La Liga', count: 27 },
      { type: 'Copa del Rey', count: 31 },
      { type: 'Champions League', count: 5 }
    ],
    players: [
      {
        id: 'lewandowski-001',
        name: 'Robert Lewandowski',
        position: 'Forward',
        jerseyNumber: 9,
        age: 35,
        height: 185,
        weight: 81,
        nationality: 'Poland',
        marketValue: 45000000,
        contractUntil: '2026-06-30',
        stats: { appearances: 35, goals: 19, assists: 5, yellowCards: 2, redCards: 0, minutesPlayed: 2890 }
      },
      {
        id: 'pedri-001',
        name: 'Pedri',
        position: 'Midfielder',
        jerseyNumber: 8,
        age: 21,
        height: 174,
        weight: 60,
        nationality: 'Spain',
        marketValue: 100000000,
        contractUntil: '2030-06-30',
        stats: { appearances: 37, goals: 4, assists: 8, yellowCards: 6, redCards: 0, minutesPlayed: 2950 }
      }
    ],
    stats: {
      teamId: 'barcelona',
      season: '2023-24',
      league: 'La Liga',
      position: 2,
      totalTeams: 20,
      gamesPlayed: 38,
      wins: 26,
      draws: 9,
      losses: 3,
      goalsFor: 76,
      goalsAgainst: 37,
      goalDifference: 39,
      points: 87,
      homeRecord: { played: 19, wins: 15, draws: 3, losses: 1, goalsFor: 45, goalsAgainst: 15 },
      awayRecord: { played: 19, wins: 11, draws: 6, losses: 2, goalsFor: 31, goalsAgainst: 22 },
      form: ['W', 'D', 'W', 'W', 'D'],
      topScorer: { playerId: 'lewandowski-001', name: 'Robert Lewandowski', goals: 19 },
      topAssist: { playerId: 'pedri-001', name: 'Pedri', assists: 8 },
      cleanSheets: 14,
      averageGoalsPerGame: 2.0,
      averageGoalsConcededPerGame: 0.97,
      possessionPercentage: 70.8,
      passAccuracy: 91.2,
      shotsPerGame: 15.6,
      shotsOnTargetPerGame: 5.9,
      cornersPerGame: 7.8,
      foulsPerGame: 12.4,
      yellowCards: 68,
      redCards: 5
    },
    recentMatches: [
      { id: 'match-015', date: '2024-05-26', opponent: 'Sevilla', isHome: true, result: 'W', score: '2-1', competition: 'La Liga' },
      { id: 'match-016', date: '2024-05-21', opponent: 'Rayo Vallecano', isHome: false, result: 'D', score: '1-1', competition: 'La Liga' }
    ],
    upcomingMatches: [
      { id: 'match-115', date: '2024-08-17', opponent: 'Valencia', isHome: true, competition: 'La Liga', time: '21:00' },
      { id: 'match-116', date: '2024-08-24', opponent: 'Athletic Bilbao', isHome: false, competition: 'La Liga', time: '19:00' }
    ],
    leagueStanding: { position: 2, points: 87, gamesPlayed: 38, wins: 26, draws: 9, losses: 3, goalsFor: 76, goalsAgainst: 37, goalDifference: 39 }
  },

  // Serie A
  'inter-milan': {
    id: 'inter-milan',
    name: 'Inter Milan',
    shortName: 'INT',
    logo: '/logos/inter-milan.png',
    founded: 1908,
    stadium: 'San Siro',
    capacity: 75923,
    city: 'Milan',
    country: 'Italy',
    league: 'Serie A',
    website: 'https://www.inter.it',
    colors: { primary: '#0068A8', secondary: '#000000' },
    achievements: [
      { type: 'Serie A', count: 20 },
      { type: 'Coppa Italia', count: 9 },
      { type: 'Champions League', count: 3 }
    ],
    players: [
      {
        id: 'lautaro-001',
        name: 'Lautaro Martínez',
        position: 'Forward',
        jerseyNumber: 10,
        age: 27,
        height: 174,
        weight: 72,
        nationality: 'Argentina',
        marketValue: 110000000,
        contractUntil: '2029-06-30',
        stats: { appearances: 33, goals: 24, assists: 2, yellowCards: 4, redCards: 0, minutesPlayed: 2650 }
      },
      {
        id: 'barella-001',
        name: 'Nicolò Barella',
        position: 'Midfielder',
        jerseyNumber: 23,
        age: 27,
        height: 172,
        weight: 68,
        nationality: 'Italy',
        marketValue: 80000000,
        contractUntil: '2029-06-30',
        stats: { appearances: 36, goals: 3, assists: 7, yellowCards: 8, redCards: 0, minutesPlayed: 2980 }
      }
    ],
    stats: {
      teamId: 'inter-milan',
      season: '2023-24',
      league: 'Serie A',
      position: 1,
      totalTeams: 20,
      gamesPlayed: 38,
      wins: 28,
      draws: 8,
      losses: 2,
      goalsFor: 89,
      goalsAgainst: 22,
      goalDifference: 67,
      points: 94,
      homeRecord: { played: 19, wins: 16, draws: 3, losses: 0, goalsFor: 52, goalsAgainst: 8 },
      awayRecord: { played: 19, wins: 12, draws: 5, losses: 2, goalsFor: 37, goalsAgainst: 14 },
      form: ['W', 'W', 'D', 'W', 'W'],
      topScorer: { playerId: 'lautaro-001', name: 'Lautaro Martínez', goals: 24 },
      topAssist: { playerId: 'barella-001', name: 'Nicolò Barella', assists: 7 },
      cleanSheets: 22,
      averageGoalsPerGame: 2.34,
      averageGoalsConcededPerGame: 0.58,
      possessionPercentage: 58.4,
      passAccuracy: 86.7,
      shotsPerGame: 14.8,
      shotsOnTargetPerGame: 5.2,
      cornersPerGame: 6.1,
      foulsPerGame: 11.2,
      yellowCards: 54,
      redCards: 2
    },
    recentMatches: [
      { id: 'match-017', date: '2024-05-26', opponent: 'Atalanta', isHome: true, result: 'W', score: '3-0', competition: 'Serie A' },
      { id: 'match-018', date: '2024-05-20', opponent: 'Frosinone', isHome: false, result: 'W', score: '5-0', competition: 'Serie A' }
    ],
    upcomingMatches: [
      { id: 'match-117', date: '2024-08-17', opponent: 'Genoa', isHome: false, competition: 'Serie A', time: '18:30' },
      { id: 'match-118', date: '2024-08-24', opponent: 'Lecce', isHome: true, competition: 'Serie A', time: '20:45' }
    ],
    leagueStanding: { position: 1, points: 94, gamesPlayed: 38, wins: 28, draws: 8, losses: 2, goalsFor: 89, goalsAgainst: 22, goalDifference: 67 }
  },

  // Bundesliga
  'bayern-munich': {
    id: 'bayern-munich',
    name: 'Bayern Munich',
    shortName: 'BAY',
    logo: '/logos/bayern-munich.png',
    founded: 1900,
    stadium: 'Allianz Arena',
    capacity: 75000,
    city: 'Munich',
    country: 'Germany',
    league: 'Bundesliga',
    website: 'https://fcbayern.com',
    colors: { primary: '#DC052D', secondary: '#0066B2' },
    achievements: [
      { type: 'Bundesliga', count: 33 },
      { type: 'DFB-Pokal', count: 20 },
      { type: 'Champions League', count: 6 }
    ],
    players: [
      {
        id: 'kane-001',
        name: 'Harry Kane',
        position: 'Forward',
        jerseyNumber: 9,
        age: 31,
        height: 188,
        weight: 86,
        nationality: 'England',
        marketValue: 100000000,
        contractUntil: '2027-06-30',
        stats: { appearances: 32, goals: 36, assists: 7, yellowCards: 2, redCards: 0, minutesPlayed: 2650 }
      },
      {
        id: 'musiala-001',
        name: 'Jamal Musiala',
        position: 'Midfielder',
        jerseyNumber: 42,
        age: 21,
        height: 180,
        weight: 70,
        nationality: 'Germany',
        marketValue: 130000000,
        contractUntil: '2026-06-30',
        stats: { appearances: 38, goals: 10, assists: 6, yellowCards: 3, redCards: 0, minutesPlayed: 2890 }
      }
    ],
    stats: {
      teamId: 'bayern-munich',
      season: '2023-24',
      league: 'Bundesliga',
      position: 3,
      totalTeams: 18,
      gamesPlayed: 34,
      wins: 24,
      draws: 7,
      losses: 3,
      goalsFor: 94,
      goalsAgainst: 45,
      goalDifference: 49,
      points: 79,
      homeRecord: { played: 17, wins: 14, draws: 2, losses: 1, goalsFor: 56, goalsAgainst: 18 },
      awayRecord: { played: 17, wins: 10, draws: 5, losses: 2, goalsFor: 38, goalsAgainst: 27 },
      form: ['W', 'L', 'W', 'W', 'D'],
      topScorer: { playerId: 'kane-001', name: 'Harry Kane', goals: 36 },
      topAssist: { playerId: 'musiala-001', name: 'Jamal Musiala', assists: 6 },
      cleanSheets: 12,
      averageGoalsPerGame: 2.76,
      averageGoalsConcededPerGame: 1.32,
      possessionPercentage: 66.2,
      passAccuracy: 89.8,
      shotsPerGame: 18.4,
      shotsOnTargetPerGame: 6.8,
      cornersPerGame: 8.2,
      foulsPerGame: 10.6,
      yellowCards: 48,
      redCards: 3
    },
    recentMatches: [
      { id: 'match-019', date: '2024-05-18', opponent: 'Hoffenheim', isHome: true, result: 'W', score: '4-2', competition: 'Bundesliga' },
      { id: 'match-020', date: '2024-05-11', opponent: 'Wolfsburg', isHome: false, result: 'W', score: '2-0', competition: 'Bundesliga' }
    ],
    upcomingMatches: [
      { id: 'match-119', date: '2024-08-25', opponent: 'Freiburg', isHome: false, competition: 'Bundesliga', time: '15:30' },
      { id: 'match-120', date: '2024-08-31', opponent: 'Bayer Leverkusen', isHome: true, competition: 'Bundesliga', time: '18:30' }
    ],
    leagueStanding: { position: 3, points: 79, gamesPlayed: 34, wins: 24, draws: 7, losses: 3, goalsFor: 94, goalsAgainst: 45, goalDifference: 49 }
  }
};

// Basketball Teams Data (NBA)
const basketballTeams: TeamDatabase = {
  'lakers': {
    id: 'lakers',
    name: 'Los Angeles Lakers',
    shortName: 'LAL',
    logo: '/logos/lakers.png',
    founded: 1947,
    stadium: 'Crypto.com Arena',
    capacity: 20000,
    city: 'Los Angeles',
    country: 'USA',
    league: 'NBA',
    website: 'https://www.nba.com/lakers',
    colors: { primary: '#552583', secondary: '#FDB927' },
    achievements: [
      { type: 'NBA Championship', count: 17 },
      { type: 'Conference Championship', count: 32 },
      { type: 'Division Championship', count: 24 }
    ],
    players: [
      {
        id: 'lebron-001',
        name: 'LeBron James',
        position: 'Small Forward',
        jerseyNumber: 23,
        age: 39,
        height: 206,
        weight: 113,
        nationality: 'USA',
        marketValue: 50000000,
        contractUntil: '2025-06-30',
        stats: { appearances: 71, points: 25.7, rebounds: 7.3, assists: 8.3, steals: 1.3, blocks: 0.5, fieldGoalPercentage: 54.0, threePointPercentage: 41.0, freeThrowPercentage: 75.0, minutesPlayed: 35.3 }
      },
      {
        id: 'davis-001',
        name: 'Anthony Davis',
        position: 'Power Forward',
        jerseyNumber: 3,
        age: 31,
        height: 208,
        weight: 115,
        nationality: 'USA',
        marketValue: 45000000,
        contractUntil: '2028-06-30',
        stats: { appearances: 76, points: 24.7, rebounds: 12.6, assists: 3.5, steals: 1.2, blocks: 2.3, fieldGoalPercentage: 55.6, threePointPercentage: 27.1, freeThrowPercentage: 81.6, minutesPlayed: 35.5 }
      }
    ],
    stats: {
      teamId: 'lakers',
      season: '2023-24',
      league: 'NBA',
      position: 7,
      totalTeams: 30,
      gamesPlayed: 82,
      wins: 47,
      draws: 0,
      losses: 35,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 47,
      homeRecord: { played: 41, wins: 26, draws: 0, losses: 15, goalsFor: 0, goalsAgainst: 0 },
      awayRecord: { played: 41, wins: 21, draws: 0, losses: 20, goalsFor: 0, goalsAgainst: 0 },
      form: ['W', 'L', 'W', 'W', 'L'],
      topScorer: { playerId: 'lebron-001', name: 'LeBron James', goals: 25.7 },
      topAssist: { playerId: 'lebron-001', name: 'LeBron James', assists: 8.3 },
      cleanSheets: 0,
      averageGoalsPerGame: 115.2,
      averageGoalsConcededPerGame: 112.8,
      possessionPercentage: 0,
      passAccuracy: 0,
      shotsPerGame: 0,
      shotsOnTargetPerGame: 0,
      cornersPerGame: 0,
      foulsPerGame: 0,
      yellowCards: 0,
      redCards: 0
    },
    recentMatches: [
      { id: 'match-007', date: '2024-04-14', opponent: 'Denver Nuggets', isHome: false, result: 'L', score: '101-114', competition: 'NBA Playoffs' },
      { id: 'match-008', date: '2024-04-11', opponent: 'Denver Nuggets', isHome: true, result: 'W', score: '119-108', competition: 'NBA Playoffs' }
    ],
    upcomingMatches: [
      { id: 'match-107', date: '2024-10-22', opponent: 'Phoenix Suns', isHome: true, competition: 'NBA Regular Season', time: '22:30' },
      { id: 'match-108', date: '2024-10-25', opponent: 'Sacramento Kings', isHome: false, competition: 'NBA Regular Season', time: '22:00' }
    ],
    leagueStanding: { position: 7, points: 47, gamesPlayed: 82, wins: 47, draws: 0, losses: 35, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 }
  },

  'celtics': {
    id: 'celtics',
    name: 'Boston Celtics',
    shortName: 'BOS',
    logo: '/logos/celtics.png',
    founded: 1946,
    stadium: 'TD Garden',
    capacity: 19156,
    city: 'Boston',
    country: 'USA',
    league: 'NBA',
    website: 'https://www.nba.com/celtics',
    colors: { primary: '#007A33', secondary: '#BA9653' },
    achievements: [
      { type: 'NBA Championship', count: 18 },
      { type: 'Conference Championship', count: 23 },
      { type: 'Division Championship', count: 33 }
    ],
    players: [
      {
        id: 'tatum-001',
        name: 'Jayson Tatum',
        position: 'Small Forward',
        jerseyNumber: 0,
        age: 26,
        height: 203,
        weight: 95,
        nationality: 'USA',
        marketValue: 55000000,
        contractUntil: '2030-06-30',
        stats: { appearances: 74, points: 26.9, rebounds: 8.1, assists: 4.9, steals: 1.0, blocks: 0.6, fieldGoalPercentage: 47.1, threePointPercentage: 37.6, freeThrowPercentage: 83.3, minutesPlayed: 35.8 }
      },
      {
        id: 'brown-001',
        name: 'Jaylen Brown',
        position: 'Shooting Guard',
        jerseyNumber: 7,
        age: 28,
        height: 201,
        weight: 101,
        nationality: 'USA',
        marketValue: 50000000,
        contractUntil: '2029-06-30',
        stats: { appearances: 70, points: 23.0, rebounds: 5.5, assists: 3.6, steals: 1.2, blocks: 0.4, fieldGoalPercentage: 49.9, threePointPercentage: 35.4, freeThrowPercentage: 70.3, minutesPlayed: 33.0 }
      }
    ],
    stats: {
      teamId: 'celtics',
      season: '2023-24',
      league: 'NBA',
      position: 1,
      totalTeams: 30,
      gamesPlayed: 82,
      wins: 64,
      draws: 0,
      losses: 18,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 64,
      homeRecord: { played: 41, wins: 37, draws: 0, losses: 4, goalsFor: 0, goalsAgainst: 0 },
      awayRecord: { played: 41, wins: 27, draws: 0, losses: 14, goalsFor: 0, goalsAgainst: 0 },
      form: ['W', 'W', 'W', 'W', 'W'],
      topScorer: { playerId: 'tatum-001', name: 'Jayson Tatum', goals: 26.9 },
      topAssist: { playerId: 'tatum-001', name: 'Jayson Tatum', assists: 4.9 },
      cleanSheets: 0,
      averageGoalsPerGame: 120.6,
      averageGoalsConcededPerGame: 110.6,
      possessionPercentage: 0,
      passAccuracy: 0,
      shotsPerGame: 0,
      shotsOnTargetPerGame: 0,
      cornersPerGame: 0,
      foulsPerGame: 0,
      yellowCards: 0,
      redCards: 0
    },
    recentMatches: [
      { id: 'match-009', date: '2024-06-17', opponent: 'Dallas Mavericks', isHome: true, result: 'W', score: '106-88', competition: 'NBA Finals' },
      { id: 'match-010', date: '2024-06-14', opponent: 'Dallas Mavericks', isHome: false, result: 'W', score: '105-98', competition: 'NBA Finals' }
    ],
    upcomingMatches: [
      { id: 'match-109', date: '2024-10-23', opponent: 'New York Knicks', isHome: true, competition: 'NBA Regular Season', time: '19:30' },
      { id: 'match-110', date: '2024-10-26', opponent: 'Washington Wizards', isHome: false, competition: 'NBA Regular Season', time: '19:00' }
    ],
    leagueStanding: { position: 1, points: 64, gamesPlayed: 82, wins: 64, draws: 0, losses: 18, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 }
  },

  'warriors': {
    id: 'warriors',
    name: 'Golden State Warriors',
    shortName: 'GSW',
    logo: '/logos/warriors.png',
    founded: 1946,
    stadium: 'Chase Center',
    capacity: 18064,
    city: 'San Francisco',
    country: 'USA',
    league: 'NBA',
    website: 'https://www.nba.com/warriors',
    colors: { primary: '#1D428A', secondary: '#FFC72C' },
    achievements: [
      { type: 'NBA Championship', count: 7 },
      { type: 'Conference Championship', count: 13 },
      { type: 'Division Championship', count: 12 }
    ],
    players: [
      {
        id: 'curry-001',
        name: 'Stephen Curry',
        position: 'Point Guard',
        jerseyNumber: 30,
        age: 36,
        height: 188,
        weight: 84,
        nationality: 'USA',
        marketValue: 48000000,
        contractUntil: '2026-06-30',
        stats: { appearances: 74, points: 26.4, rebounds: 4.5, assists: 5.1, steals: 0.9, blocks: 0.4, fieldGoalPercentage: 45.0, threePointPercentage: 40.8, freeThrowPercentage: 91.0, minutesPlayed: 32.7 }
      },
      {
        id: 'thompson-001',
        name: 'Klay Thompson',
        position: 'Shooting Guard',
        jerseyNumber: 11,
        age: 34,
        height: 198,
        weight: 98,
        nationality: 'USA',
        marketValue: 43000000,
        contractUntil: '2024-06-30',
        stats: { appearances: 77, points: 17.9, rebounds: 3.3, assists: 2.3, steals: 0.6, blocks: 0.4, fieldGoalPercentage: 43.2, threePointPercentage: 38.7, freeThrowPercentage: 92.7, minutesPlayed: 29.7 }
      }
    ],
    stats: {
      teamId: 'warriors',
      season: '2023-24',
      league: 'NBA',
      position: 10,
      totalTeams: 30,
      gamesPlayed: 82,
      wins: 46,
      draws: 0,
      losses: 36,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 46,
      homeRecord: { played: 41, wins: 31, draws: 0, losses: 10, goalsFor: 0, goalsAgainst: 0 },
      awayRecord: { played: 41, wins: 15, draws: 0, losses: 26, goalsFor: 0, goalsAgainst: 0 },
      form: ['L', 'W', 'L', 'W', 'L'],
      topScorer: { playerId: 'curry-001', name: 'Stephen Curry', goals: 26.4 },
      topAssist: { playerId: 'curry-001', name: 'Stephen Curry', assists: 5.1 },
      cleanSheets: 0,
      averageGoalsPerGame: 123.2,
      averageGoalsConcededPerGame: 123.2,
      possessionPercentage: 0,
      passAccuracy: 0,
      shotsPerGame: 0,
      shotsOnTargetPerGame: 0,
      cornersPerGame: 0,
      foulsPerGame: 0,
      yellowCards: 0,
      redCards: 0
    },
    recentMatches: [
      { id: 'match-021', date: '2024-04-14', opponent: 'Sacramento Kings', isHome: false, result: 'L', score: '118-123', competition: 'NBA Regular Season' },
      { id: 'match-022', date: '2024-04-12', opponent: 'Utah Jazz', isHome: true, result: 'W', score: '123-116', competition: 'NBA Regular Season' }
    ],
    upcomingMatches: [
      { id: 'match-121', date: '2024-10-23', opponent: 'Portland Trail Blazers', isHome: true, competition: 'NBA Regular Season', time: '22:00' },
      { id: 'match-122', date: '2024-10-26', opponent: 'Utah Jazz', isHome: false, competition: 'NBA Regular Season', time: '21:00' }
    ],
    leagueStanding: { position: 10, points: 46, gamesPlayed: 82, wins: 46, draws: 0, losses: 36, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 }
  },

  'heat': {
    id: 'heat',
    name: 'Miami Heat',
    shortName: 'MIA',
    logo: '/logos/heat.png',
    founded: 1988,
    stadium: 'Kaseya Center',
    capacity: 19600,
    city: 'Miami',
    country: 'USA',
    league: 'NBA',
    website: 'https://www.nba.com/heat',
    colors: { primary: '#98002E', secondary: '#F9A01B' },
    achievements: [
      { type: 'NBA Championship', count: 3 },
      { type: 'Conference Championship', count: 7 },
      { type: 'Division Championship', count: 16 }
    ],
    players: [
      {
        id: 'butler-001',
        name: 'Jimmy Butler',
        position: 'Small Forward',
        jerseyNumber: 22,
        age: 35,
        height: 201,
        weight: 104,
        nationality: 'USA',
        marketValue: 48000000,
        contractUntil: '2025-06-30',
        stats: { appearances: 60, points: 20.8, rebounds: 5.3, assists: 4.8, steals: 1.3, blocks: 0.2, fieldGoalPercentage: 49.9, threePointPercentage: 41.4, freeThrowPercentage: 85.8, minutesPlayed: 33.0 }
      },
      {
        id: 'adebayo-001',
        name: 'Bam Adebayo',
        position: 'Center',
        jerseyNumber: 13,
        age: 27,
        height: 206,
        weight: 116,
        nationality: 'USA',
        marketValue: 32000000,
        contractUntil: '2029-06-30',
        stats: { appearances: 71, points: 19.3, rebounds: 10.4, assists: 3.9, steals: 1.1, blocks: 0.9, fieldGoalPercentage: 52.1, threePointPercentage: 35.7, freeThrowPercentage: 75.2, minutesPlayed: 34.0 }
      }
    ],
    stats: {
      teamId: 'heat',
      season: '2023-24',
      league: 'NBA',
      position: 8,
      totalTeams: 30,
      gamesPlayed: 82,
      wins: 46,
      draws: 0,
      losses: 36,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 46,
      homeRecord: { played: 41, wins: 26, draws: 0, losses: 15, goalsFor: 0, goalsAgainst: 0 },
      awayRecord: { played: 41, wins: 20, draws: 0, losses: 21, goalsFor: 0, goalsAgainst: 0 },
      form: ['W', 'L', 'W', 'W', 'L'],
      topScorer: { playerId: 'butler-001', name: 'Jimmy Butler', goals: 20.8 },
      topAssist: { playerId: 'butler-001', name: 'Jimmy Butler', assists: 4.8 },
      cleanSheets: 0,
      averageGoalsPerGame: 111.9,
      averageGoalsConcededPerGame: 110.5,
      possessionPercentage: 0,
      passAccuracy: 0,
      shotsPerGame: 0,
      shotsOnTargetPerGame: 0,
      cornersPerGame: 0,
      foulsPerGame: 0,
      yellowCards: 0,
      redCards: 0
    },
    recentMatches: [
      { id: 'match-023', date: '2024-04-21', opponent: 'Boston Celtics', isHome: false, result: 'L', score: '102-118', competition: 'NBA Playoffs' },
      { id: 'match-024', date: '2024-04-17', opponent: 'Boston Celtics', isHome: true, result: 'W', score: '111-101', competition: 'NBA Playoffs' }
    ],
    upcomingMatches: [
      { id: 'match-123', date: '2024-10-23', opponent: 'Orlando Magic', isHome: true, competition: 'NBA Regular Season', time: '19:30' },
      { id: 'match-124', date: '2024-10-26', opponent: 'Charlotte Hornets', isHome: false, competition: 'NBA Regular Season', time: '19:00' }
    ],
    leagueStanding: { position: 8, points: 46, gamesPlayed: 82, wins: 46, draws: 0, losses: 36, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 }
  }
};

// American Football Teams Data (NFL)
const americanFootballTeams: TeamDatabase = {
  'patriots': {
    id: 'patriots',
    name: 'New England Patriots',
    shortName: 'NE',
    logo: '/logos/patriots.png',
    founded: 1960,
    stadium: 'Gillette Stadium',
    capacity: 65878,
    city: 'Foxborough',
    country: 'USA',
    league: 'NFL',
    website: 'https://www.patriots.com',
    colors: { primary: '#002244', secondary: '#C60C30' },
    achievements: [
      { type: 'Super Bowl', count: 6 },
      { type: 'AFC Championship', count: 13 },
      { type: 'Division Championship', count: 22 }
    ],
    players: [
      {
        id: 'jones-001',
        name: 'Mac Jones',
        position: 'Quarterback',
        jerseyNumber: 10,
        age: 26,
        height: 191,
        weight: 98,
        nationality: 'USA',
        marketValue: 15000000,
        contractUntil: '2025-06-30',
        stats: { appearances: 17, touchdowns: 15, interceptions: 10, passingYards: 2611, rushingYards: 54, completionPercentage: 64.4, quarterbackRating: 82.6, sacks: 33, fumbles: 8, minutesPlayed: 1020 }
      },
      {
        id: 'henry-001',
        name: 'Hunter Henry',
        position: 'Tight End',
        jerseyNumber: 85,
        age: 30,
        height: 196,
        weight: 113,
        nationality: 'USA',
        marketValue: 12000000,
        contractUntil: '2025-06-30',
        stats: { appearances: 17, touchdowns: 2, receptions: 42, receivingYards: 419, rushingYards: 0, completionPercentage: 0, quarterbackRating: 0, sacks: 0, fumbles: 1, minutesPlayed: 850 }
      }
    ],
    stats: {
      teamId: 'patriots',
      season: '2023-24',
      league: 'NFL',
      position: 4,
      totalTeams: 32,
      gamesPlayed: 17,
      wins: 4,
      draws: 0,
      losses: 13,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 4,
      homeRecord: { played: 9, wins: 3, draws: 0, losses: 6, goalsFor: 0, goalsAgainst: 0 },
      awayRecord: { played: 8, wins: 1, draws: 0, losses: 7, goalsFor: 0, goalsAgainst: 0 },
      form: ['L', 'L', 'W', 'L', 'L'],
      topScorer: { playerId: 'jones-001', name: 'Mac Jones', goals: 15 },
      topAssist: { playerId: 'jones-001', name: 'Mac Jones', assists: 15 },
      cleanSheets: 0,
      averageGoalsPerGame: 13.9,
      averageGoalsConcededPerGame: 21.1,
      possessionPercentage: 0,
      passAccuracy: 0,
      shotsPerGame: 0,
      shotsOnTargetPerGame: 0,
      cornersPerGame: 0,
      foulsPerGame: 0,
      yellowCards: 0,
      redCards: 0
    },
    recentMatches: [
      { id: 'match-025', date: '2024-01-07', opponent: 'New York Jets', isHome: false, result: 'W', score: '17-3', competition: 'NFL Regular Season' },
      { id: 'match-026', date: '2023-12-31', opponent: 'Buffalo Bills', isHome: true, result: 'L', score: '21-35', competition: 'NFL Regular Season' }
    ],
    upcomingMatches: [
      { id: 'match-125', date: '2024-09-08', opponent: 'Cincinnati Bengals', isHome: true, competition: 'NFL Regular Season', time: '13:00' },
      { id: 'match-126', date: '2024-09-15', opponent: 'Seattle Seahawks', isHome: false, competition: 'NFL Regular Season', time: '13:00' }
    ],
    leagueStanding: { position: 4, points: 4, gamesPlayed: 17, wins: 4, draws: 0, losses: 13, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 }
  },

  'cowboys': {
    id: 'cowboys',
    name: 'Dallas Cowboys',
    shortName: 'DAL',
    logo: '/logos/cowboys.png',
    founded: 1960,
    stadium: 'AT&T Stadium',
    capacity: 80000,
    city: 'Arlington',
    country: 'USA',
    league: 'NFL',
    website: 'https://www.dallascowboys.com',
    colors: { primary: '#003594', secondary: '#869397' },
    achievements: [
      { type: 'Super Bowl', count: 5 },
      { type: 'NFC Championship', count: 8 },
      { type: 'Division Championship', count: 24 }
    ],
    players: [
      {
        id: 'prescott-001',
        name: 'Dak Prescott',
        position: 'Quarterback',
        jerseyNumber: 4,
        age: 31,
        height: 188,
        weight: 104,
        nationality: 'USA',
        marketValue: 40000000,
        contractUntil: '2028-06-30',
        stats: { appearances: 17, touchdowns: 36, interceptions: 9, passingYards: 4516, rushingYards: 105, completionPercentage: 69.5, quarterbackRating: 105.9, sacks: 35, fumbles: 3, minutesPlayed: 1020 }
      },
      {
        id: 'lamb-001',
        name: 'CeeDee Lamb',
        position: 'Wide Receiver',
        jerseyNumber: 88,
        age: 25,
        height: 188,
        weight: 89,
        nationality: 'USA',
        marketValue: 35000000,
        contractUntil: '2028-06-30',
        stats: { appearances: 17, touchdowns: 12, receptions: 135, receivingYards: 1749, rushingYards: 21, completionPercentage: 0, quarterbackRating: 0, sacks: 0, fumbles: 0, minutesPlayed: 1020 }
      }
    ],
    stats: {
      teamId: 'cowboys',
      season: '2023-24',
      league: 'NFL',
      position: 2,
      totalTeams: 32,
      gamesPlayed: 17,
      wins: 12,
      draws: 0,
      losses: 5,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 12,
      homeRecord: { played: 9, wins: 8, draws: 0, losses: 1, goalsFor: 0, goalsAgainst: 0 },
      awayRecord: { played: 8, wins: 4, draws: 0, losses: 4, goalsFor: 0, goalsAgainst: 0 },
      form: ['W', 'W', 'L', 'W', 'W'],
      topScorer: { playerId: 'prescott-001', name: 'Dak Prescott', goals: 36 },
      topAssist: { playerId: 'prescott-001', name: 'Dak Prescott', assists: 36 },
      cleanSheets: 0,
      averageGoalsPerGame: 29.9,
      averageGoalsConcededPerGame: 20.1,
      possessionPercentage: 0,
      passAccuracy: 0,
      shotsPerGame: 0,
      shotsOnTargetPerGame: 0,
      cornersPerGame: 0,
      foulsPerGame: 0,
      yellowCards: 0,
      redCards: 0
    },
    recentMatches: [
      { id: 'match-027', date: '2024-01-14', opponent: 'Green Bay Packers', isHome: true, result: 'L', score: '32-48', competition: 'NFL Playoffs' },
      { id: 'match-028', date: '2024-01-07', opponent: 'Washington Commanders', isHome: false, result: 'W', score: '38-10', competition: 'NFL Regular Season' }
    ],
    upcomingMatches: [
      { id: 'match-127', date: '2024-09-08', opponent: 'Cleveland Browns', isHome: true, competition: 'NFL Regular Season', time: '16:25' },
      { id: 'match-128', date: '2024-09-15', opponent: 'New Orleans Saints', isHome: false, competition: 'NFL Regular Season', time: '13:00' }
    ],
    leagueStanding: { position: 2, points: 12, gamesPlayed: 17, wins: 12, draws: 0, losses: 5, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 }
  },

  'packers': {
    id: 'packers',
    name: 'Green Bay Packers',
    shortName: 'GB',
    logo: '/logos/packers.png',
    founded: 1919,
    stadium: 'Lambeau Field',
    capacity: 81441,
    city: 'Green Bay',
    country: 'USA',
    league: 'NFL',
    website: 'https://www.packers.com',
    colors: { primary: '#203731', secondary: '#FFB612' },
    achievements: [
      { type: 'Super Bowl', count: 4 },
      { type: 'NFC Championship', count: 5 },
      { type: 'Division Championship', count: 22 }
    ],
    players: [
      {
        id: 'love-001',
        name: 'Jordan Love',
        position: 'Quarterback',
        jerseyNumber: 10,
        age: 26,
        height: 193,
        weight: 102,
        nationality: 'USA',
        marketValue: 25000000,
        contractUntil: '2027-06-30',
        stats: { appearances: 17, touchdowns: 32, interceptions: 11, passingYards: 4159, rushingYards: 247, completionPercentage: 64.2, quarterbackRating: 96.1, sacks: 35, fumbles: 6, minutesPlayed: 1020 }
      },
      {
        id: 'watson-001',
        name: 'Christian Watson',
        position: 'Wide Receiver',
        jerseyNumber: 9,
        age: 25,
        height: 193,
        weight: 95,
        nationality: 'USA',
        marketValue: 8000000,
        contractUntil: '2026-06-30',
        stats: { appearances: 15, touchdowns: 5, receptions: 28, receivingYards: 422, rushingYards: 5, completionPercentage: 0, quarterbackRating: 0, sacks: 0, fumbles: 0, minutesPlayed: 750 }
      }
    ],
    stats: {
      teamId: 'packers',
      season: '2023-24',
      league: 'NFL',
      position: 7,
      totalTeams: 32,
      gamesPlayed: 18,
      wins: 10,
      draws: 0,
      losses: 8,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 10,
      homeRecord: { played: 9, wins: 6, draws: 0, losses: 3, goalsFor: 0, goalsAgainst: 0 },
      awayRecord: { played: 9, wins: 4, draws: 0, losses: 5, goalsFor: 0, goalsAgainst: 0 },
      form: ['W', 'L', 'W', 'W', 'L'],
      topScorer: { playerId: 'love-001', name: 'Jordan Love', goals: 32 },
      topAssist: { playerId: 'love-001', name: 'Jordan Love', assists: 32 },
      cleanSheets: 0,
      averageGoalsPerGame: 24.6,
      averageGoalsConcededPerGame: 21.8,
      possessionPercentage: 0,
      passAccuracy: 0,
      shotsPerGame: 0,
      shotsOnTargetPerGame: 0,
      cornersPerGame: 0,
      foulsPerGame: 0,
      yellowCards: 0,
      redCards: 0
    },
    recentMatches: [
      { id: 'match-029', date: '2024-01-20', opponent: 'San Francisco 49ers', isHome: false, result: 'L', score: '21-24', competition: 'NFL Playoffs' },
      { id: 'match-030', date: '2024-01-14', opponent: 'Dallas Cowboys', isHome: false, result: 'W', score: '48-32', competition: 'NFL Playoffs' }
    ],
    upcomingMatches: [
      { id: 'match-129', date: '2024-09-06', opponent: 'Philadelphia Eagles', isHome: false, competition: 'NFL Regular Season', time: '20:15' },
      { id: 'match-130', date: '2024-09-15', opponent: 'Indianapolis Colts', isHome: true, competition: 'NFL Regular Season', time: '13:00' }
    ],
    leagueStanding: { position: 7, points: 10, gamesPlayed: 18, wins: 10, draws: 0, losses: 8, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 }
  },

  'chiefs': {
    id: 'chiefs',
    name: 'Kansas City Chiefs',
    shortName: 'KC',
    logo: '/logos/chiefs.png',
    founded: 1960,
    stadium: 'Arrowhead Stadium',
    capacity: 76416,
    city: 'Kansas City',
    country: 'USA',
    league: 'NFL',
    website: 'https://www.chiefs.com',
    colors: { primary: '#E31837', secondary: '#FFB81C' },
    achievements: [
      { type: 'Super Bowl', count: 3 },
      { type: 'AFC Championship', count: 4 },
      { type: 'Division Championship', count: 9 }
    ],
    players: [
      {
        id: 'mahomes-001',
        name: 'Patrick Mahomes',
        position: 'Quarterback',
        jerseyNumber: 15,
        age: 29,
        height: 191,
        weight: 104,
        nationality: 'USA',
        marketValue: 45000000,
        contractUntil: '2031-06-30',
        stats: { appearances: 16, touchdowns: 27, interceptions: 14, passingYards: 4183, rushingYards: 389, completionPercentage: 67.2, quarterbackRating: 92.6, sacks: 57, fumbles: 12, minutesPlayed: 960 }
      },
      {
        id: 'kelce-001',
        name: 'Travis Kelce',
        position: 'Tight End',
        jerseyNumber: 87,
        age: 35,
        height: 196,
        weight: 113,
        nationality: 'USA',
        marketValue: 14000000,
        contractUntil: '2025-06-30',
        stats: { appearances: 16, touchdowns: 5, receptions: 93, receivingYards: 984, rushingYards: 1, completionPercentage: 0, quarterbackRating: 0, sacks: 0, fumbles: 2, minutesPlayed: 960 }
      }
    ],
    stats: {
      teamId: 'chiefs',
      season: '2023-24',
      league: 'NFL',
      position: 1,
      totalTeams: 32,
      gamesPlayed: 20,
      wins: 17,
      draws: 0,
      losses: 3,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 17,
      homeRecord: { played: 10, wins: 9, draws: 0, losses: 1, goalsFor: 0, goalsAgainst: 0 },
      awayRecord: { played: 10, wins: 8, draws: 0, losses: 2, goalsFor: 0, goalsAgainst: 0 },
      form: ['W', 'W', 'W', 'W', 'W'],
      topScorer: { playerId: 'mahomes-001', name: 'Patrick Mahomes', goals: 27 },
      topAssist: { playerId: 'mahomes-001', name: 'Patrick Mahomes', assists: 27 },
      cleanSheets: 0,
      averageGoalsPerGame: 21.8,
      averageGoalsConcededPerGame: 17.3,
      possessionPercentage: 0,
      passAccuracy: 0,
      shotsPerGame: 0,
      shotsOnTargetPerGame: 0,
      cornersPerGame: 0,
      foulsPerGame: 0,
      yellowCards: 0,
      redCards: 0
    },
    recentMatches: [
      { id: 'match-007', date: '2024-02-11', opponent: 'San Francisco 49ers', isHome: false, result: 'W', score: '25-22', competition: 'Super Bowl LVIII' },
      { id: 'match-008', date: '2024-01-28', opponent: 'Baltimore Ravens', isHome: true, result: 'W', score: '17-10', competition: 'AFC Championship' }
    ],
    upcomingMatches: [
      { id: 'match-107', date: '2024-09-05', opponent: 'Baltimore Ravens', isHome: true, competition: 'NFL Regular Season', time: '20:20' },
      { id: 'match-108', date: '2024-09-15', opponent: 'Cincinnati Bengals', isHome: false, competition: 'NFL Regular Season', time: '16:25' }
    ],
    leagueStanding: { position: 1, points: 17, gamesPlayed: 20, wins: 17, draws: 0, losses: 3, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 }
  }
};

// Combined teams database
const allTeams: TeamDatabase = {
  ...footballTeams,
  ...basketballTeams,
  ...americanFootballTeams
};

// Mock API implementation
export class MockTeamsAPI implements MockTeamsAPI {
  private teams: TeamDatabase;

  constructor() {
    this.teams = allTeams;
  }

  getTeamById(teamId: string): TeamDetails | null {
    return this.teams[teamId] || null;
  }

  getTeamsBySport(sport: SportType): TeamDetails[] {
    const sportTeamMap = {
      'football': footballTeams,
      'basketball': basketballTeams,
      'american-football': americanFootballTeams
    };
    
    const sportTeams = sportTeamMap[sport] || {};
    return Object.values(sportTeams);
  }

  getAllTeams(): TeamDetails[] {
    return Object.values(this.teams);
  }

  getRandomTeam(sport?: SportType): TeamDetails {
    const teams = sport ? this.getTeamsBySport(sport) : this.getAllTeams();
    const randomIndex = Math.floor(Math.random() * teams.length);
    return teams[randomIndex];
  }

  // Additional utility methods
  getTeamsByLeague(league: string): TeamDetails[] {
    return Object.values(this.teams).filter(team => team.league === league);
  }

  searchTeams(query: string): TeamDetails[] {
    const lowerQuery = query.toLowerCase();
    return Object.values(this.teams).filter(team => 
      team.name.toLowerCase().includes(lowerQuery) ||
      team.shortName.toLowerCase().includes(lowerQuery) ||
      team.city.toLowerCase().includes(lowerQuery) ||
      team.league.toLowerCase().includes(lowerQuery)
    );
  }
}

// Export singleton instance
export const mockTeamsAPI = new MockTeamsAPI();

// Export team data for direct access
export { footballTeams, basketballTeams, americanFootballTeams, allTeams };