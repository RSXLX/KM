'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { LiveMatchCard, LiveMatch } from './LiveMatchCard';
import { InPlaySidebar } from '@/components/sports/InPlaySidebar';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInplayMarkets } from '@/hooks/useInplayMarkets';

interface LiveInPlayGridProps {
  matches?: LiveMatch[];
  status?: 'live' | 'pre'; // 添加状态参数
}

// API 返回可能包含额外信息（name、createdAt、state），与前端结构兼容
type ApiMatch = LiveMatch & { name?: string; createdAt?: string; state?: string };

export function LiveInPlayGrid({ matches, status = 'live' }: LiveInPlayGridProps) {
  const { data: inplayList, isLoading, error } = useInplayMarkets();

  // 侧边栏状态
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LiveMatch | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  // 直接使用后端 In-Play 数据并映射到 LiveMatch
  const mappedFromApi: LiveMatch[] = useMemo(() => {
    return (inplayList || []).map(item => {
      const [homeNameRaw, awayNameRaw] = String(item.title || 'Home vs Away').split(/\s+vs\s+/i);
      const homeName = (homeNameRaw || 'Home').trim();
      const awayName = (awayNameRaw || 'Away').trim();
      const liveOdds = item.moneyline ? { home: item.moneyline.home, away: item.moneyline.away, lastUpdated: item.timestamp } : undefined;
      return {
        id: String(item.market_id),
        sport: item.category || 'Sports',
        teams: { home: { name: homeName, score: item.score?.home }, away: { name: awayName, score: item.score?.away } },
        status: { isLive: item.status?.isLive ?? true, time: item.status?.time ?? 'Live', phase: item.status?.phase, minute: item.status?.minute, second: item.status?.second, period: item.status?.period },
        liveOdds,
        marketUrl: `/sports-betting?fixtureId=${item.market_id}`,
        league: item.category || 'Sports',
      } as LiveMatch;
    });
  }, [inplayList]);

  // 仅在接口不可用时用于展示的回退示例
  const fallbackSample: LiveMatch[] = [];

  // 独立请求逻辑移除：统一使用 useActiveMarkets 提供的 data/loading/error

  // 确定最终显示的数据
  const displayMatches = matches || mappedFromApi;
  const items = displayMatches;

  // 根据 URL 参数恢复抽屉状态
  useEffect(() => {
    const inplayId = searchParams?.get('inplay');
    if (!inplayId || !items) return;
    const found = items.find(m => m.id === inplayId);
    if (found) {
      setSelected(found);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items]);

  const onOpen = (m: LiveMatch) => {
    setSelected(m);
    setOpen(true);
    // 写入 URL 参数以便状态持久化
    const params = new URLSearchParams(searchParams?.toString());
    params.set('inplay', m.id);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  };

  const onClose = () => {
    setOpen(false);
    // 清除 URL 中的 inplay 参数
    const params = new URLSearchParams(searchParams?.toString());
    params.delete('inplay');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '', { scroll: false });
  };

  if (!items) {
    if (isLoading) {
      return <div className="text-muted-foreground">Loading in-play matches...</div>;
    }
    if (error) {
      return (
        <div>
          <div className="mb-4 text-destructive">Failed to load: {error}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {fallbackSample.map((m) => (
              <LiveMatchCard key={m.id} match={m} onOpen={onOpen} />
            ))}
          </div>
          <InPlaySidebar open={open} onClose={onClose} match={selected ?? undefined} />
        </div>
      );
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {(items ?? []).map((m) => (
          <LiveMatchCard key={m.id} match={m} onOpen={onOpen} />
        ))}
      </div>
      <InPlaySidebar open={open} onClose={onClose} match={selected ?? undefined} />
    </>
  );
}