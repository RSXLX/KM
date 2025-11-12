'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  
  // 联动与倒计时状态
  const [taskStartAt, setTaskStartAt] = useState<number | null>(null);
  const TASK_DURATION_MS = 30 * 60 * 1000; // 30分钟
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [marketMeta, setMarketMeta] = useState<{ id: number; version: number } | null>(null);
  const [linkStatus, setLinkStatus] = useState<'idle' | 'ui-only' | 'linked' | 'settling' | 'done' | 'error'>('idle');
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  
  // 根据状态选择合适的数据源（优先使用外部传入的 matches）
  const baseData = status === 'live'
    ? (matches ?? (liveMatches?.length ? liveMatches : mockLiveMatches))
    : (matches ?? mockPreGameMatches);
  
  // 只对 live 状态使用实时数据模拟器
  const { matches: simulatedMatches, isRunning, startSimulation, stopSimulation, setMatches } = useLiveDataSimulator(
    baseData,
    {
      enabled: status === 'live', // 只在 live 状态启用模拟器
      updateInterval: 3000,
      autoStart: status === 'live'
    }
  );

  // 将赛程数据转换为 LiveMatch 用于列表展示与模拟器推进
  const toLiveMatchFromFixture = (fx: any): LiveMatch => {
    const id = String(fx?.id ?? `fx_${Date.now()}`);
    const sport = String(fx?.sport ?? 'Sports');
    const home = String(fx?.homeTeam ?? 'Home');
    const away = String(fx?.awayTeam ?? 'Away');
    const liveOdds = fx?.liveOdds ?? fx?.preOdds ?? {};
    const odds = {
      home: Number(liveOdds?.home ?? liveOdds?.Home ?? 0) || undefined,
      draw: Number(liveOdds?.draw ?? liveOdds?.Draw ?? 0) || undefined,
      away: Number(liveOdds?.away ?? liveOdds?.Away ?? 0) || undefined,
      lastUpdated: Date.now(),
      trend: 'stable' as const,
    };
    return {
      id,
      sport,
      teams: {
        home: { name: home, score: 0 },
        away: { name: away, score: 0 },
      },
      status: {
        time: "00'",
        isLive: true,
        phase: 'Live',
        minute: 0,
        period: 1,
      },
      liveOdds: odds,
      marketUrl: '/sports-betting',
      startTime: String(fx?.kickoffTime ?? ''),
      league: fx?.league ?? undefined,
    };
  };

  // 辅助：将毫秒格式化为 mm:ss
  const fmtMs = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 判断选择的比赛ID是否为数字（对应后端 market_id）
  const selectedMarketId = (() => {
    const id = selected?.id ?? '';
    if (!id) return null;
    return /^\d+$/.test(String(id)) ? Number(id) : null;
  })();

  // 启动联动（更新后端为 Active 并开始前端模拟与倒计时）
  const handleStartLinked = async () => {
    try {
      setInfoMsg(null);
      if (!status || status !== 'live') {
        setInfoMsg('当前非 live 状态，无法启动联动。');
        return;
      }
      const { apiClient } = await import('@/lib/apiClient');
      // 1) 随机从赛程接口挑选一条（优先选择 pre 状态）
      const fxResp = await apiClient.get('/api/v1/sports/fixtures', { query: { page: 1, limit: 50 }, timeoutMs: 8000 });
      const fixtures: any[] = fxResp?.data?.fixtures ?? fxResp?.fixtures ?? [];
      if (!Array.isArray(fixtures) || fixtures.length === 0) {
        setInfoMsg('未获取到赛程数据，启动前端模拟。');
        setLinkStatus('ui-only');
        startSimulation();
        setTaskStartAt(Date.now());
        setRemainingMs(TASK_DURATION_MS);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          const elapsed = Date.now() - (taskStartAt ?? Date.now());
          const left = Math.max(0, TASK_DURATION_MS - elapsed);
          setRemainingMs(left);
          if (left <= 0) { clearInterval(countdownRef.current!); void handleStopAndSettle(); }
        }, 1000);
        return;
      }
      const preList = fixtures.filter((f: any) => String(f?.status ?? '').toLowerCase() === 'pre');
      const pool = preList.length ? preList : fixtures;
      const rnd = pool[Math.floor(Math.random() * pool.length)];
      const marketIdStr = String(rnd?.id ?? '');
      const marketId = marketIdStr && /^\d+$/.test(marketIdStr) ? Number(marketIdStr) : null;
      if (!marketId) {
        setInfoMsg('赛程ID不可用，启动前端模拟。');
        setLinkStatus('ui-only');
        startSimulation();
        setTaskStartAt(Date.now());
        setRemainingMs(TASK_DURATION_MS);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          const elapsed = Date.now() - (taskStartAt ?? Date.now());
          const left = Math.max(0, TASK_DURATION_MS - elapsed);
          setRemainingMs(left);
          if (left <= 0) { clearInterval(countdownRef.current!); void handleStopAndSettle(); }
        }, 1000);
        return;
      }

      // 2) 获取市场详情以获得内部 id 与 version（GET /api/v1/markets/{market_id}）
      const detail = await apiClient.get(`/api/v1/markets/${marketId}`, { timeoutMs: 8000 });
      const internalId = Number(detail?.data?.id ?? detail?.id ?? marketId);
      const version = Number(detail?.data?.version ?? detail?.version ?? 0);
      if (!internalId || Number.isNaN(internalId)) {
        setInfoMsg('后端市场ID解析失败，将进行前端模拟。');
        setLinkStatus('ui-only');
        startSimulation();
        setTaskStartAt(Date.now());
        setRemainingMs(TASK_DURATION_MS);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          const elapsed = Date.now() - (taskStartAt ?? Date.now());
          const left = Math.max(0, TASK_DURATION_MS - elapsed);
          setRemainingMs(left);
          if (left <= 0) { clearInterval(countdownRef.current!); void handleStopAndSettle(); }
        }, 1000);
        return;
      }

      // 3) 更新状态为 active（PUT /api/v1/markets/{id}）
      await apiClient.put(`/api/v1/markets/${internalId}`, {
        expected_version: version,
        status: 'active',
      }, { timeoutMs: 8000 });
      setMarketMeta({ id: internalId, version });
      setLinkStatus('linked');

      // 注入所选赛程为一条新的 LiveMatch 到列表中，确保首页 In-Play 能看到
      const lm = toLiveMatchFromFixture(rnd);
      setMatches((curr) => {
        const exists = (curr || []).some((m) => String(m.id) === String(lm.id));
        return exists ? curr.map((m) => (String(m.id) === String(lm.id) ? lm : m)) : [lm, ...(curr || [])];
      });

      startSimulation();
      setTaskStartAt(Date.now());
      setRemainingMs(TASK_DURATION_MS);

      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - (taskStartAt ?? Date.now());
        const left = Math.max(0, TASK_DURATION_MS - elapsed);
        setRemainingMs(left);
        if (left <= 0) {
          clearInterval(countdownRef.current!);
          void handleStopAndSettle();
        }
      }, 1000);
    } catch (e: any) {
      console.error('[LiveInPlayGrid] start linked failed:', e);
      setLinkStatus('error');
      setInfoMsg(e?.message ?? '启动联动失败');
    }
  };

  // 计算胜者（简单根据比分高低；平局时默认主队胜）
  const computeWinningOption = (m: LiveMatch | null) => {
    if (!m) return 1;
    const home = Number(m.teams.home.score ?? 0);
    const away = Number(m.teams.away.score ?? 0);
    if (home === away) return 1; // 简化：平局按主队
    return home > away ? 1 : 2;
  };

  // 停止并结算（POST /api/v1/admin/markets/{id}/settle）
  const handleStopAndSettle = async () => {
    try {
      setLinkStatus('settling');
      stopSimulation();
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      const winningOption = computeWinningOption(selected);

      // 若无后端联动，仅前端结束提示
      if (!marketMeta?.id) {
        setLinkStatus('done');
        setInfoMsg(`模拟结束（前端）。胜方：${winningOption === 1 ? '主队' : '客队'}`);
        return;
      }

      const { apiClient } = await import('@/lib/apiClient');
      const resp = await apiClient.post(`/api/v1/admin/markets/${marketMeta.id}/settle`, {
        winning_option: winningOption,
        resolved_at: new Date().toISOString(),
      }, { timeoutMs: 10000 });
      setLinkStatus('done');
      setInfoMsg('已结算为结束状态');
    } catch (e: any) {
      console.error('[LiveInPlayGrid] settle failed:', e);
      setLinkStatus('error');
      setInfoMsg(e?.message ?? '结算失败');
    }
  };

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

  // 确定最终显示的数据：live 状态优先显示模拟推进后的列表
  const items = status === 'live' ? simulatedMatches : (matches ?? baseData);

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
          {taskStartAt && (
            <div className="text-xs text-muted-foreground">
              剩余时间: {fmtMs(remainingMs)}
            </div>
          )}
          {linkStatus !== 'idle' && (
            <div className="text-xs">
              联动状态: {linkStatus === 'linked' ? '已与后端联动' : linkStatus === 'ui-only' ? '仅前端模拟' : linkStatus === 'settling' ? '结算中' : linkStatus === 'done' ? '已结束' : linkStatus === 'error' ? '失败' : '待启动'}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleStartLinked}
              disabled={isRunning}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50"
            >
              启动
            </button>
            <button
              onClick={handleStopAndSettle}
              disabled={!isRunning}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded disabled:opacity-50"
            >
              停止
            </button>
          </div>
          {infoMsg && (
            <div className="text-xs text-muted-foreground">
              {infoMsg}
            </div>
          )}
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