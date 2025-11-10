'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { LiveInPlayGrid } from '@/components/sports/LiveInPlayGrid';
import type { LiveMatch } from '@/components/sports/LiveMatchCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { fetchFixtures, type MockFixture } from '@/lib/sports/mockFixtures';
import { enrichFixture } from '@/lib/sports/classification';
import apiClient from '@/lib/apiClient';

export function SportsClassifiedGrid() {
  // 从后端加载 fixtures，失败时回退到本地 mock
  const [fixtures, setFixtures] = useState<MockFixture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeSport, setActiveSport] = useState<string>('All');
  const [activeLeagues, setActiveLeagues] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState<string>('');
  const [activeStatus, setActiveStatus] = useState<'pre' | 'live'>('pre');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const apiFixtures = await fetchFixtures({ status: activeStatus, page: 1, limit: 50 });
        if (!cancelled) setFixtures(apiFixtures);
      } catch (e) {
        console.warn('[SportsClassifiedGrid] load fixtures failed:', e);
        if (!cancelled) setError('加载后端赛程失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeStatus]);

  const enriched = useMemo(() => fixtures.map(f => ({ f, c: enrichFixture(f) })), [fixtures]);

  const sports = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach(({ c }) => set.add(c.sport));
    return Array.from(set);
  }, [enriched]);

  const leagues = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach(({ c }) => c.league && set.add(c.league));
    return Array.from(set);
  }, [enriched]);

  // 状态声明已上移以便触发后端加载

  const toggleLeague = (lg: string) => {
    const next = new Set(activeLeagues);
    if (next.has(lg)) next.delete(lg); else next.add(lg);
    setActiveLeagues(next);
  };

  const filtered = useMemo(() => {
    return enriched.filter(({ f, c }) => {
      const statusOk = f.status ? (f.status === activeStatus) : (activeStatus === 'pre');
      const sportOk = activeSport === 'All' ? true : c.sport === activeSport;
      const leagueOk = activeLeagues.size === 0 ? true : (c.league ? activeLeagues.has(c.league) : false);
      const text = `${f.title} ${f.homeTeam} ${f.awayTeam}`.toLowerCase();
      const qOk = query ? text.includes(query.toLowerCase()) : true;
      return statusOk && sportOk && leagueOk && qOk;
    });
  }, [enriched, activeStatus, activeSport, activeLeagues, query]);

  const matches: LiveMatch[] = useMemo(() => {
    return filtered.map(({ f, c }) => ({
      id: f.id,
      sport: c.sport,
      teams: { home: { name: f.homeTeam }, away: { name: f.awayTeam } },
      status: { time: f.kickoffTime, isLive: f.status === 'live' },
      liveOdds: (f.status === 'live' ? f.liveOdds : f.preOdds) || undefined,
      // 统一 fixtureId 为数值（尾部数字或原始ID作为回退）
      marketUrl: (() => {
        const tail = String(f.id.match(/\d+$/)?.[0] || f.id);
        return `/sports-betting?fixtureId=${encodeURIComponent(tail)}&autoOpen=1`;
      })()
    }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* 筛选区 */}
      <Card className="tech-card">
        <CardHeader>
          <CardTitle className="text-lg">Browse Sports Fixtures</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (<div className="text-sm text-muted-foreground mb-2">Loading fixtures...</div>)}
          {error && (<div className="text-sm text-red-600 mb-2">{error}</div>)}
          {/* 状态切换：Pre / In-Play */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              className={`px-3 py-1 rounded-md text-sm border ${activeStatus === 'pre' ? 'bg-primary text-primary-foreground' : 'bg-muted'} hover:bg-accent`}
              onClick={() => setActiveStatus('pre')}
            >Pre-Game</button>
            <button
              className={`px-3 py-1 rounded-md text-sm border ${activeStatus === 'live' ? 'bg-primary text-primary-foreground' : 'bg-muted'} hover:bg-accent`}
              onClick={() => setActiveStatus('live')}
            >In-Play</button>
          </div>

          {/* 一级：运动类型 Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              className={`px-3 py-1 rounded-md text-sm border ${activeSport === 'All' ? 'bg-primary text-primary-foreground' : 'bg-muted'} hover:bg-accent`}
              onClick={() => setActiveSport('All')}
            >All</button>
            {sports.map(sp => (
              <button
                key={sp}
                className={`px-3 py-1 rounded-md text-sm border ${activeSport === sp ? 'bg-primary text-primary-foreground' : 'bg-muted'} hover:bg-accent`}
                onClick={() => setActiveSport(sp)}
              >{sp}</button>
            ))}
          </div>



          {/* 搜索框 */}
          <div className="flex items-center gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or teams"
            />
          </div>

          <Separator className="my-4" />

        </CardContent>
      </Card>

      {/* 列表区：仅显示当前状态对应的数据 */}
      <LiveInPlayGrid matches={matches} status={activeStatus} />
    </div>
  );
}