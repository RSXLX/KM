'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { LiveInPlayGrid } from '@/components/sports/LiveInPlayGrid';
import type { LiveMatch } from '@/components/sports/LiveMatchCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
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

  // 当处于 In-Play（live）状态时，周期刷新赛程，确保后端 Active 改动能及时反映到列表
  useEffect(() => {
    if (activeStatus !== 'live') return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const apiFixtures = await fetchFixtures({ status: 'live', page: 1, limit: 50 });
        if (!cancelled) setFixtures(apiFixtures);
      } catch (e) {
        // 静默失败，保留现有列表
      }
    }, 10000); // 10s 刷新一次
    return () => { cancelled = true; clearInterval(interval); };
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
       
        </CardHeader>
        <CardContent>
          {loading && (<div className="text-sm text-muted-foreground mb-2">Loading fixtures...</div>)}
          {error && (<div className="text-sm text-red-600 mb-2">{error}</div>)}
          {/* 状态切换：Pre / In-Play */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant={activeStatus === 'pre' ? 'default' : 'outline'} size="sm" onClick={() => setActiveStatus('pre')}>Pre-Game</Button>
            <Button variant={activeStatus === 'live' ? 'default' : 'outline'} size="sm" onClick={() => setActiveStatus('live')}>In-Play</Button>
          </div>

          {/* 一级：运动类型 Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant={activeSport === 'All' ? 'default' : 'outline'} size="sm" onClick={() => setActiveSport('All')}>All</Button>
            {sports.map(sp => (
              <Button key={sp} variant={activeSport === sp ? 'default' : 'outline'} size="sm" onClick={() => setActiveSport(sp)}>{sp}</Button>
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
      <div className="flex items-center gap-2">
        <Badge variant="outline">Matches: {matches.length}</Badge>
        <Badge variant={activeStatus === 'live' ? 'default' : 'secondary'}>
          {activeStatus === 'live' ? 'In-Play' : 'Pre-Game'}
        </Badge>
      </div>
      <LiveInPlayGrid matches={matches} status={activeStatus} />
    </div>
  );
}