import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TeamInfo {
  name: string;
  score: number;
  code?: string;
}

interface LiveMatchItem {
  id: string;
  name: string; // 赛事名称：例如 Lakers vs Celtics
  createdAt: string; // ISO string
  state: 'live' | 'ended' | 'scheduled'; // 状态字段
  sport: string;
  teams: {
    home: TeamInfo;
    away: TeamInfo;
  };
  status: {
    time: string;
    isLive: boolean;
    phase?: string;
  };
  liveOdds: {
    home: number;
    away: number;
    draw?: number;
  };
  marketUrl: string;
}

function makeISO(minutesAgo: number): string {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  return d.toISOString();
}

export async function GET() {
  const data: LiveMatchItem[] = [
    {
      id: 'nba-lal-bos-001',
      name: 'Lakers vs Celtics',
      createdAt: makeISO(25),
      state: 'live',
      sport: 'NBA',
      teams: {
        home: { name: 'Lakers', score: 102, code: 'LAL' },
        away: { name: 'Celtics', score: 105, code: 'BOS' },
      },
      status: { time: 'Q4 02:15', isLive: true, phase: 'Q4' },
      liveOdds: { home: 2.1, away: 1.8 },
      marketUrl: '/sports-betting',
    },
    {
      id: 'epl-mci-ars-002',
      name: 'Man City vs Arsenal',
      createdAt: makeISO(60),
      state: 'live',
      sport: 'Premier League',
      teams: {
        home: { name: 'Man City', score: 1, code: 'MCI' },
        away: { name: 'Arsenal', score: 1, code: 'ARS' },
      },
      status: { time: "81'", isLive: true },
      liveOdds: { home: 2.6, draw: 3.1, away: 2.4 },
      marketUrl: '/sports-betting',
    },
    {
      id: 'nfl-nyj-cin-003',
      name: 'Jets vs Bengals',
      createdAt: makeISO(45),
      state: 'live',
      sport: 'NFL',
      teams: {
        home: { name: 'Jets', score: 17, code: 'NYJ' },
        away: { name: 'Bengals', score: 21, code: 'CIN' },
      },
      status: { time: 'Q3 04:42', isLive: true, phase: 'Q3' },
      liveOdds: { home: 2.9, away: 1.5 },
      marketUrl: '/sports-betting',
    },
    {
      id: 'laliga-fcb-rma-004',
      name: 'Barcelona vs Real Madrid',
      createdAt: makeISO(70),
      state: 'live',
      sport: 'La Liga',
      teams: {
        home: { name: 'Barcelona', score: 2, code: 'FCB' },
        away: { name: 'Real Madrid', score: 2, code: 'RMA' },
      },
      status: { time: "87'", isLive: true },
      liveOdds: { home: 2.7, draw: 2.9, away: 2.5 },
      marketUrl: '/sports-betting',
    },
    {
      id: 'mlb-nyy-bos-005',
      name: 'Yankees vs Red Sox',
      createdAt: makeISO(15),
      state: 'live',
      sport: 'MLB',
      teams: {
        home: { name: 'Yankees', score: 4, code: 'NYY' },
        away: { name: 'Red Sox', score: 3, code: 'BOS' },
      },
      status: { time: 'Top 7th', isLive: true },
      liveOdds: { home: 1.9, away: 2.0 },
      marketUrl: '/sports-betting',
    },
    {
      id: 'nba-gsw-lac-006',
      name: 'Warriors vs Clippers',
      createdAt: makeISO(10),
      state: 'live',
      sport: 'NBA',
      teams: {
        home: { name: 'Warriors', score: 88, code: 'GSW' },
        away: { name: 'Clippers', score: 90, code: 'LAC' },
      },
      status: { time: 'Q3 01:33', isLive: true, phase: 'Q3' },
      liveOdds: { home: 2.2, away: 1.7 },
      marketUrl: '/sports-betting',
    },
    {
      id: 'epl-liv-che-007',
      name: 'Liverpool vs Chelsea',
      createdAt: makeISO(95),
      state: 'live',
      sport: 'Premier League',
      teams: {
        home: { name: 'Liverpool', score: 2, code: 'LIV' },
        away: { name: 'Chelsea', score: 1, code: 'CHE' },
      },
      status: { time: "76'", isLive: true },
      liveOdds: { home: 1.8, draw: 3.6, away: 3.2 },
      marketUrl: '/sports-betting',
    },
  ];

  return NextResponse.json(data, { status: 200 });
}