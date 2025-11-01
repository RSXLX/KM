import { useEffect, useRef, useState } from 'react';
import { computeLiquidation, calculatePayout, SelectedTeam } from '@/lib/sports/odds';

export interface Team {
  code: string;
  name: string;
}

export interface SportsOdds {
  home: number;
  away: number;
  liquidation: number;
}

export interface SportsWager {
  amount: number;
  multiplier: number;
  payout: number;
  selectedTeam: SelectedTeam;
}

export interface BetRecord {
  matchId: string;
  team: Exclude<SelectedTeam, null>;
  teamCode: string;
  teamName: string;
  odds: number;
  multiplier: number;
  amount: number;
  payout: number;
  timestamp: number;
}

export interface LivePoint { t: number; ts: number; home: number; away: number; }

export interface MatchData {
  matchId: string;
  marketAddress?: string;
  teams: {
    home: Team;
    away: Team;
  };
  odds: SportsOdds;
  wager: SportsWager;
  kickoffAt?: number;
}

export function useSportsBetting(initialId?: string) {
  const [matchData, setMatchData] = useState<MatchData>({
    matchId: initialId || '001',
    marketAddress: undefined, // 将在加载时设置
    teams: {
      home: { code: 'NYJ', name: 'New York Jets' },
      away: { code: 'CIN', name: 'Cincinnati Bengals' }
    },
    odds: {
      home: 0,
      away: 0,
      liquidation: 0
    },
    wager: {
      amount: 0,
      multiplier: 1,
      payout: 0,
      selectedTeam: null
    }
  });

  const baseLiquidationRef = useRef<number>(0);

  const [isLive, setIsLive] = useState<boolean>(false);
  const [liveSeries, setLiveSeries] = useState<LivePoint[]>([]);
  const liveTimerRef = useRef<number | null>(null);
  const liveStartAtRef = useRef<number>(0);
  const TICK_MS = 1000;

  const abbr = (name: string) => {
    const letters = name.split(/\s+/).map(w => w[0] || '').join('').toUpperCase();
    return letters.slice(0, 3) || name.slice(0, 3).toUpperCase();
  };

  const generateRandomOdds = () => {
    const homeOdds = parseFloat((Math.random() * 0.6 + 1.7).toFixed(2));
    const awayOdds = parseFloat((Math.random() * 0.6 + 1.7).toFixed(2));
    const liquidationBase = parseFloat((Math.random() * 0.6 + 2.2).toFixed(2));

    setMatchData(prev => ({
      ...prev,
      marketAddress: prev.marketAddress || `market_${prev.matchId}`, // 设置默认 marketAddress
      odds: {
        home: homeOdds,
        away: awayOdds,
        liquidation: computeLiquidation(liquidationBase, prev.wager.multiplier)
      }
    }));
    baseLiquidationRef.current = liquidationBase;
  };

  const updateMultiplier = (multiplier: number) => {
    setMatchData(prev => ({
      ...prev,
      odds: {
        ...prev.odds,
        liquidation: computeLiquidation(baseLiquidationRef.current || prev.odds.liquidation, multiplier)
      },
      wager: {
        ...prev.wager,
        multiplier,
        payout: calculatePayout(prev.wager.amount, multiplier, prev.wager.selectedTeam, prev.odds)
      }
    }));
  };

  const updateWagerAmount = (amount: number) => {
    setMatchData(prev => ({
      ...prev,
      wager: {
        ...prev.wager,
        amount,
        payout: calculatePayout(amount, prev.wager.multiplier, prev.wager.selectedTeam, prev.odds)
      }
    }));
  };

  const selectTeam = (team: Exclude<SelectedTeam, null>) => {
    setMatchData(prev => ({
      ...prev,
      wager: {
        ...prev.wager,
        selectedTeam: team,
        payout: calculatePayout(prev.wager.amount, prev.wager.multiplier, team, prev.odds)
      }
    }));
  };

  const loadFixtureById = async (id: string) => {
    try {
      // 优先使用本地预设 mock 数据
      const local = await (async () => {
        try {
          const mod = await import('@/lib/sports/mockFixtures');
          // dynamic import to avoid SSR issues
          return (mod as any).getFixtureById?.(id);
        } catch {
          return undefined;
        }
      })();

      if (local) {
        const homeOdds = parseFloat(String(local.preOdds?.home ?? 0)) || matchData.odds.home;
        const awayOdds = parseFloat(String(local.preOdds?.away ?? 0)) || matchData.odds.away;
        const liquidationBase = parseFloat((Math.max(homeOdds, awayOdds) * 0.85 || 2.2).toFixed(2));
        baseLiquidationRef.current = liquidationBase;
        setMatchData(prev => ({
          ...prev,
          matchId: String(local.id ?? id),
          marketAddress: local.marketAddress || `market_${id}`, // 从本地数据获取或生成默认值
          teams: {
            home: { code: abbr(String(local.homeTeam ?? 'HOME')), name: String(local.homeTeam ?? 'Home') },
            away: { code: abbr(String(local.awayTeam ?? 'AWAY')), name: String(local.awayTeam ?? 'Away') },
          },
          odds: {
            home: homeOdds,
            away: awayOdds,
            liquidation: computeLiquidation(liquidationBase, prev.wager.multiplier)
          }
        }));
        return; // 已命中本地数据，结束
      }

      // 回退到 API 请求（开发环境可能不可用）
      const res = await fetch(`/api/mock/fixtures/${id}`);
      if (!res.ok) throw new Error('Failed to load mock fixture');
      const data = await res.json();
      const homeOdds = parseFloat(String(data.odds?.home ?? 0)) || matchData.odds.home;
      const awayOdds = parseFloat(String(data.odds?.away ?? 0)) || matchData.odds.away;
      const liquidationBase = parseFloat((Math.max(homeOdds, awayOdds) * 0.85 || 2.2).toFixed(2));
      baseLiquidationRef.current = liquidationBase;
      setMatchData(prev => ({
        ...prev,
        matchId: String(data.fixture?.id ?? id),
        marketAddress: data.marketAddress || `market_${id}`, // 从 API 获取或生成默认值
        teams: {
          home: { code: abbr(String(data.teams?.home?.name ?? 'HOME')), name: String(data.teams?.home?.name ?? 'Home') },
          away: { code: abbr(String(data.teams?.away?.name ?? 'AWAY')), name: String(data.teams?.away?.name ?? 'Away') },
        },
        odds: {
          home: homeOdds,
          away: awayOdds,
          liquidation: computeLiquidation(liquidationBase, prev.wager.multiplier)
        }
      }));
    } catch (e) {
      console.warn('[useSportsBetting] load fixture failed:', e);
      generateRandomOdds();
    }
  };

  // initialize
  useEffect(() => {
    if (initialId) {
      loadFixtureById(initialId);
    } else {
      generateRandomOdds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep payout in sync
  useEffect(() => {
    const newPayout = calculatePayout(
      matchData.wager.amount,
      matchData.wager.multiplier,
      matchData.wager.selectedTeam,
      { home: matchData.odds.home, away: matchData.odds.away }
    );
    setMatchData(prev => ({
      ...prev,
      wager: {
        ...prev.wager,
        payout: newPayout
      }
    }));
  }, [matchData.wager.amount, matchData.wager.multiplier, matchData.wager.selectedTeam, matchData.odds.home, matchData.odds.away]);

  const chartData = [
    { name: matchData.teams.home.code, odds: matchData.odds.home, fill: '#6A4BFF' },
    { name: matchData.teams.away.code, odds: matchData.odds.away, fill: '#00E0A8' }
  ];

  const liveChartData = liveSeries.map(p => ({ t: p.t, ts: p.ts, home: p.home, away: p.away }));

  const [bets, setBets] = useState<BetRecord[]>([]);

  const placeBet = (): BetRecord[] => {
    const sel = matchData.wager.selectedTeam;
    if (!sel || matchData.wager.amount <= 0) {
      return bets;
    }
    const teamObj = sel === 'home' ? matchData.teams.home : matchData.teams.away;
    const oddsSel = sel === 'home' ? matchData.odds.home : matchData.odds.away;
    const record: BetRecord = {
      matchId: matchData.matchId,
      team: sel,
      teamCode: teamObj.code,
      teamName: teamObj.name,
      odds: oddsSel,
      multiplier: matchData.wager.multiplier,
      amount: matchData.wager.amount,
      payout: matchData.wager.payout,
      timestamp: Date.now()
    };
    const next = [...bets, record];
    setBets(next);
    return next;
  };

  // Live simulation tick: opposing movements with mild mean reversion
  const liveTick = () => {
    let newPoint: LivePoint | null = null;
    setLiveSeries(prev => {
      const last = prev.length ? prev[prev.length - 1] : { t: 0, ts: liveStartAtRef.current, home: matchData.odds.home || 1.8, away: matchData.odds.away || 2.0 };
      const t = last.t + 1;
      const ts = liveStartAtRef.current + t * TICK_MS;
      const baseVol = 0.08;
      const eventShock = Math.random() < 0.06 ? (Math.random() - 0.5) * 0.25 : 0;
      const swing = (Math.random() - 0.5) * baseVol + eventShock;
      const homeRaw = parseFloat((last.home + swing).toFixed(2));
      const awayRaw = parseFloat((last.away - swing).toFixed(2));
      const clamp = (v: number) => Math.max(1.1, Math.min(3.5, v));
      const mr = 0.02;
      const home = parseFloat((clamp(homeRaw) + mr * (2.0 - clamp(homeRaw))).toFixed(2));
      const away = parseFloat((clamp(awayRaw) + mr * (2.0 - clamp(awayRaw))).toFixed(2));
      newPoint = { t, ts, home, away };
      const next = [...prev.slice(-119), newPoint];
      return next;
    });
    if (newPoint) {
      setMatchData(prev => ({
        ...prev,
        odds: {
          ...prev.odds,
          home: newPoint!.home,
          away: newPoint!.away,
          liquidation: prev.odds.liquidation,
        }
      }));
    }
  };

  const startLive = () => {
    if (isLive) return;
    setIsLive(true);
    liveStartAtRef.current = Date.now();
    setLiveSeries([{ t: 0, ts: liveStartAtRef.current, home: matchData.odds.home || 1.8, away: matchData.odds.away || 2.0 }]);
    const id = window.setInterval(liveTick, TICK_MS);
    liveTimerRef.current = id;
  };

  const stopLive = () => {
    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    setIsLive(false);
  };

  return {
    matchData,
    chartData,
    liveChartData,
    isLive,
    startLive,
    stopLive,
    generateRandomOdds,
    updateMultiplier,
    updateWagerAmount,
    selectTeam,
    loadFixtureById,
    bets,
    placeBet,
  };
}