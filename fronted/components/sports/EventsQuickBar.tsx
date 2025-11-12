'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type LiveMatch } from '@/components/sports/LiveMatchCard';
import { fetchFixtures, type MockFixture } from '@/lib/sports/mockFixtures';
import { classifyFixtureTitle } from '@/lib/sports/classification';
import { InPlaySidebar } from '@/components/sports/InPlaySidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type LeagueOption = {
  value: string;
  label: string;
};

const LEAGUES: LeagueOption[] = [
  { value: 'ALL', label: 'All Events' },
  { value: 'NFL', label: 'NFL' },
  { value: 'NBA', label: 'NBA' },
  { value: 'NCAA', label: 'NCAA' },
  { value: 'MLB', label: 'MLB' },
  { value: 'Premier League', label: 'Premier League' },
  { value: 'La Liga', label: 'La Liga' },
  { value: 'Serie A', label: 'Serie A' },
];

// 简单的队名缩写
const abbr = (name: string) => {
  const letters = name.split(/\s+/).map(w => w[0] || '').join('').toUpperCase();
  return letters.slice(0, 3) || name.slice(0, 3).toUpperCase();
};

// 将后端 Fixture 转换为 LiveMatchCard 可用结构
function fixtureToLiveMatch(f: MockFixture): LiveMatch {
  const { sport, league } = classifyFixtureTitle(f.title, f.sport);
  const isLive = f.status === 'live';
  const isFinal = f.status === 'final';
  const phase = isFinal ? 'Full Time' : isLive ? 'In Play' : 'Scheduled';
  const startTime = typeof f.kickoffTime === 'string' ? f.kickoffTime : new Date(f.kickoffTime).toISOString();
  const odds = f.liveOdds ?? f.preOdds ?? undefined;
  return {
    id: String(f.id),
    sport: sport || f.sport,
    league: league ?? f.league,
    teams: {
      home: { name: f.homeTeam, code: abbr(f.homeTeam) },
      away: { name: f.awayTeam, code: abbr(f.awayTeam) },
    },
    status: {
      time: isLive ? undefined : new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isLive,
      phase,
      finished: isFinal,
    },
    liveOdds: odds ? { home: odds.home, away: odds.away, draw: odds.draw ?? undefined } : undefined,
    marketUrl: '/sports-betting',
    startTime,
  };
}

function useFixturesSource() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const fixtures = await fetchFixtures({ page: 1, limit: 50 });
      const mm = fixtures.map(fixtureToLiveMatch);
      setMatches(mm);
      setError(null);
    } catch (e: any) {
      console.warn('[EventsQuickBar] load fixtures failed:', e);
      setError(e?.message || 'load_failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000); // 10s 自动刷新
    return () => clearInterval(id);
  }, []);

  return { matches, loading, error, refresh: load };
}

export function EventsQuickBar() {
  const { matches: allMatches, loading, error } = useFixturesSource();

  // 状态筛选（ALL / LIVE / PRE / FINAL）与体育分类（ALL / sport）
  type StatusTab = 'ALL' | 'LIVE' | 'PRE' | 'FINAL';
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL');
  const [selectedSport, setSelectedSport] = useState<string>('ALL');

  const liveCount = useMemo(() => (allMatches || []).filter(m => m?.status?.isLive).length, [allMatches]);
  const finalCount = useMemo(() => (allMatches || []).filter(m => m?.status?.finished).length, [allMatches]);
  const preCount = useMemo(() => Math.max(0, (allMatches?.length || 0) - liveCount - finalCount), [allMatches, liveCount, finalCount]);

  // 根据选中状态与体育分类过滤
  const filteredItems = useMemo(() => {
    let base = [...(allMatches || [])];
    if (statusTab === 'LIVE') base = base.filter(m => m?.status?.isLive === true);
    else if (statusTab === 'FINAL') base = base.filter(m => m?.status?.finished === true);
    else if (statusTab === 'PRE') base = base.filter(m => !m?.status?.isLive && !m?.status?.finished);
    if (selectedSport !== 'ALL') base = base.filter(m => String(m.sport) === selectedSport);
    return base;
  }, [allMatches, statusTab, selectedSport]);

  // 分类（基于 sport）
  const categories = useMemo(() => Array.from(new Set(filteredItems.map(m => String(m.sport)))), [filteredItems]);

  // 按分类分组
  const grouped = useMemo(() => {
    const map: Record<string, LiveMatch[]> = {};
    categories.forEach(cat => { map[cat] = []; });
    filteredItems.forEach(m => {
      const cat = String(m.sport);
      (map[cat] ||= []).push(m);
    });
    return map;
  }, [filteredItems, categories]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollBy = (delta: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const scrollToCategory = (cat: string) => {
    const el = anchorsRef.current[cat];
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    scroller.scrollTo({ left: el.offsetLeft - 12, behavior: 'smooth' });
  };

  // 抽屉交互
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LiveMatch | null>(null);
  const onOpen = (match: LiveMatch) => { setSelected(match); setOpen(true); };
  const onClose = () => setOpen(false);

  return (
    <div className="w-full max-w-screen-2xl mx-auto overflow-hidden">
      {/* 顶部筛选：状态 + 体育分类 */}
      <div className="flex items-center justify-between mb-2 px-1">
        {/* 状态筛选 */}
        <div className="flex items-center gap-1">
          {[
            { key: 'ALL', label: `全部 (${allMatches?.length || 0})` },
            { key: 'LIVE', label: `直播 (${liveCount})` },
            { key: 'PRE', label: `赛前 (${preCount})` },
            { key: 'FINAL', label: `已结束 (${finalCount})` },
          ].map(t => (
            <Button
              key={t.key}
              onClick={() => setStatusTab(t.key as StatusTab)}
              variant={statusTab === t.key ? 'default' : 'outline'}
              size="sm"
            >
              {t.label}
            </Button>
          ))}
        </div>

        {/* 体育分类按钮（水平滚动，含“All”） */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide max-w-[65vw] sm:max-w-[50vw] md:max-w-[40vw] lg:max-w-[35vw]">
          <Button
            onClick={() => setSelectedSport('ALL')}
            variant={selectedSport === 'ALL' ? 'secondary' : 'outline'}
            size="sm"
          >
            All Sports
          </Button>
          {categories.map(cat => (
            <Button
              key={`cat-btn-${cat}`}
              onClick={() => setSelectedSport(cat)}
              variant={selectedSport === cat ? 'secondary' : 'outline'}
              size="sm"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>
      {/* 响应式滚动区域 */}
      <div className="w-full max-w-full overflow-hidden">
        <div
          ref={scrollerRef}
          className="flex gap-2 w-full max-w-full overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory pb-2 box-border"
        >
          {categories.map((cat) => (
            <React.Fragment key={`group-${cat}`}>
              {/* 分类锚点卡片 */}
              <Card
                className="border bg-card text-card-foreground shadow-sm snap-start rounded-none border-dashed flex-shrink-0 w-[20vw] sm:w-[16vw] md:w-[12vw] lg:w-[8vw] xl:w-[6vw] min-w-[80px] max-w-[140px] h-[clamp(100px,20vw,120px)]"
                role="button"
                onClick={() => scrollToCategory(cat)}
              >
                <CardContent className="p-4 flex items-center justify-center">
                  <span className="text-xs sm:text-sm font-semibold">{cat}</span>
                </CardContent>
              </Card>

              {/* 该分类下的比赛卡片 */}
              {(grouped[cat] || []).map((m, idx) => (
                <div
                  key={m.id}
                  ref={idx === 0 ? (el) => { anchorsRef.current[cat] = el; } : undefined}
                  className="snap-start flex-shrink-0 w-[88vw] sm:w-[72vw] md:w-[54vw] lg:w-[36vw] xl:w-[28vw] 2xl:w-[24vw] min-w-[220px] max-w-[560px]"
                >
                  <Card
                    className="border bg-card text-card-foreground shadow-sm h-[clamp(100px,20vw,120px)] rounded-none cursor-pointer select-none transition-transform duration-300 ease-out hover:scale-[1.02] active:scale-[0.995] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    onClick={() => onOpen(m)}
                  >
                    <CardContent className="p-2">
                      <div className="text-[10px] md:text-[11px] text-muted-foreground mb-0.5 flex items-center justify-between leading-tight">
                        <span>{m.league ?? m.sport}</span>
                        {m?.status?.isLive ? (
                          <Badge variant="default" className="gap-1 px-1.5 py-0.5 text-[10px] md:text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] md:text-[11px]">
                            {m?.status?.finished ? 'FT' : 'Scheduled'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate text-xs md:text-sm leading-tight">{m.teams?.home?.name}</div>
                        <span className="text-muted-foreground text-[10px] md:text-xs">vs</span>
                        <div className="font-medium truncate text-xs md:text-sm leading-tight">{m.teams?.away?.name}</div>
                      </div>
                      <div className="mt-0.5 text-[10px] md:text-xs text-muted-foreground flex items-center justify-between leading-tight">
                        <span>{m?.status?.time ?? (m?.status?.finished ? '完场' : '进行中')}</span>
                        <span className="text-[10px] md:text-xs">{m?.status?.phase ?? ''}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 右侧抽屉详情 */}
      <InPlaySidebar open={open} onClose={onClose} match={selected ?? undefined} />
    </div>
  );
}

export default EventsQuickBar;