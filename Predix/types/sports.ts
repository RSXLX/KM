// 球队信息类型定义
export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  founded: number;
  country: string;
  city: string;
  stadium: string;
  capacity: number;
  coach: string;
  website?: string;
  colors: {
    primary: string;
    secondary: string;
  };
  league: string;
  division?: string;
}

// 球员信息类型定义
export interface PlayerInfo {
  id: string;
  name: string;
  position: string;
  number: number;
  age: number;
  nationality: string;
  height: string;
  weight: string;
  photo: string;
  teamId: string;
  stats: PlayerStats;
}

// 球员统计类型定义
export interface PlayerStats {
  gamesPlayed: number;
  goals?: number;
  assists?: number;
  yellowCards?: number;
  redCards?: number;
  minutesPlayed: number;
  // 篮球统计
  points?: number;
  rebounds?: number;
  steals?: number;
  blocks?: number;
  // 美式足球统计
  touchdowns?: number;
  yards?: number;
  completions?: number;
  attempts?: number;
}

// 球队统计类型定义
export interface TeamStats {
  teamId: string;
  season: string;
  league: string;
  // 基础统计
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  position: number;
  // 进攻统计
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  // 详细统计
  homeRecord: {
    wins: number;
    draws: number;
    losses: number;
  };
  awayRecord: {
    wins: number;
    draws: number;
    losses: number;
  };
  form: string[]; // 最近5场比赛结果 ['W', 'L', 'D', 'W', 'W']
  averageGoalsPerGame: number;
  averageGoalsConcededPerGame: number;
  cleanSheets: number;
  failedToScore: number;
}

// 球队详细信息（包含所有相关数据）
export interface TeamDetails {
  info: TeamInfo;
  stats: TeamStats;
  players: PlayerInfo[];
  recentMatches: RecentMatch[];
  upcomingMatches: UpcomingMatch[];
}

// 最近比赛记录
export interface RecentMatch {
  id: string;
  date: string;
  opponent: {
    id: string;
    name: string;
    logo: string;
  };
  isHome: boolean;
  score: {
    home: number;
    away: number;
  };
  result: 'W' | 'L' | 'D';
  competition: string;
}

// 即将到来的比赛
export interface UpcomingMatch {
  id: string;
  date: string;
  opponent: {
    id: string;
    name: string;
    logo: string;
  };
  isHome: boolean;
  competition: string;
  venue: string;
}

// 联赛排名信息
export interface LeagueStanding {
  position: number;
  team: {
    id: string;
    name: string;
    logo: string;
  };
  stats: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
  };
  form: string[];
}