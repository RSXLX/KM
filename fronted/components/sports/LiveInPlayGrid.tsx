'use client';

import React, { useEffect, useState } from 'react';
import { LiveMatchCard, LiveMatch } from './LiveMatchCard';
import { InPlaySidebar } from '@/components/sports/InPlaySidebar';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSportsBetting } from '@/hooks/useSportsBetting';
import { mockLiveMatches } from '@/lib/sports/mockLiveMatches';
import { mockPreGameMatches } from '@/lib/sports/mockPreGameMatches';
import { useLiveDataSimulator } from '@/hooks/useLiveDataSimulator';

interface LiveInPlayGridProps {
  matches?: LiveMatch[];
  status?: 'live' | 'pre'; // 添加状态参数
}

// API 返回可能包含额外信息（name、createdAt、state），与前端结构兼容
type ApiMatch = LiveMatch & { name?: string; createdAt?: string; state?: string };

export function LiveInPlayGrid({ matches, status = 'live' }: LiveInPlayGridProps) {
  const [data, setData] = useState<LiveMatch[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 侧边栏状态
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LiveMatch | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { liveMatches, isLoading } = useSportsBetting();
  
  // 根据状态选择合适的数据源
  const baseData = status === 'live' 
    ? (liveMatches?.length ? liveMatches : mockLiveMatches)
    : mockPreGameMatches;
  
  // 只对 live 状态使用实时数据模拟器
  const { matches: simulatedMatches, isRunning, startSimulation, stopSimulation } = useLiveDataSimulator(
    baseData,
    {
      enabled: status === 'live', // 只在 live 状态启用模拟器
      updateInterval: 3000,
      autoStart: status === 'live'
    }
  );

  // 仅在接口不可用时用于展示的回退示例
  const fallbackSample: LiveMatch[] = [
    {
      id: 'nba-001',
      sport: 'NBA',
      teams: {
        home: { name: 'Lakers', score: 102, code: 'LAL' },
        away: { name: 'Celtics', score: 105, code: 'BOS' },
      },
      status: { 
        time: 'Q4 02:15', 
        isLive: true, 
        phase: 'Q4',
        minute: 10,
        second: 45,
        period: 4
      },
      liveOdds: { 
        home: 2.1, 
        away: 1.8,
        lastUpdated: Date.now(),
        trend: 'down'
      },
      marketUrl: '/sports-betting',
      startTime: '2024-01-20T20:00:00Z',
      venue: 'Crypto.com Arena',
      league: 'NBA'
    },
    {
      id: 'epl-002',
      sport: 'Premier League',
      teams: {
        home: { name: 'Man City', score: 1, code: 'MCI' },
        away: { name: 'Arsenal', score: 1, code: 'ARS' },
      },
      status: { 
        time: "81'", 
        isLive: true,
        phase: 'Second Half',
        minute: 81,
        period: 2
      },
      liveOdds: { 
        home: 2.6, 
        draw: 3.1, 
        away: 2.4,
        lastUpdated: Date.now(),
        trend: 'stable'
      },
      marketUrl: '/sports-betting',
      startTime: '2024-01-20T15:00:00Z',
      venue: 'Etihad Stadium',
      league: 'Premier League'
    },
    {
      id: 'nfl-003',
      sport: 'NFL',
      teams: {
        home: { name: 'Jets', score: 17, code: 'NYJ' },
        away: { name: 'Bengals', score: 21, code: 'CIN' },
      },
      status: { 
        time: 'Q3 04:42', 
        isLive: true, 
        phase: 'Q3',
        minute: 4,
        second: 42,
        period: 3
      },
      liveOdds: { 
        home: 2.9, 
        away: 1.5,
        lastUpdated: Date.now(),
        trend: 'up'
      },
      marketUrl: '/sports-betting',
      startTime: '2024-01-20T18:00:00Z',
      venue: 'MetLife Stadium',
      league: 'NFL'
    },
  ];

  useEffect(() => {
    if (matches && matches.length > 0) return; // 已传入数据则不请求

    const controller = new AbortController();
    let cancelled = false;

    async function fetchLive() {
      try {
        setLoading(true);
        setError(null);
        const { apiClient } = await import('@/lib/apiClient');
        const json: ApiMatch[] = await apiClient.get('/api/mock/live', {
          timeoutMs: 8000,
          dedup: true,
          signal: controller.signal,
        });
        if (!cancelled) {
          if (Array.isArray(json)) {
            setData(json as LiveMatch[]);
          } else {
            throw new Error('Invalid data format');
          }
        }
      } catch (e: any) {
        const isAbort = e?.name === 'AbortError'
          || (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError')
          || (typeof e?.message === 'string' && /aborted|AbortError|The operation was aborted|ERR_ABORTED/i.test(e.message));
        if (isAbort) {
          return;
        }
        if (!cancelled) {
          setError(e?.message ?? 'Fetch failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLive();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [matches]);

  // 确定最终显示的数据
  const displayMatches = matches || (status === 'live' ? simulatedMatches : baseData);
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
    if (loading) {
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
      {/* 实时数据模拟器控制面板 - 仅在 live 状态显示 */}
      {status === 'live' && (
        <div className="mb-4 flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium">
              实时数据模拟: {isRunning ? '运行中' : '已停止'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={startSimulation}
              disabled={isRunning}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50"
            >
              启动
            </button>
            <button
              onClick={stopSimulation}
              disabled={!isRunning}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded disabled:opacity-50"
            >
              停止
            </button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {(items ?? []).map((m) => (
          <LiveMatchCard key={m.id} match={m} onOpen={onOpen} />
        ))}
      </div>
      <InPlaySidebar open={open} onClose={onClose} match={selected ?? undefined} />
    </>
  );
}