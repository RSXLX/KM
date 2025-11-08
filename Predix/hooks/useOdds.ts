'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch, OddsResponse } from '@/lib/api';

export type NormalizedOdds = {
  home?: number;
  away?: number;
  spread?: { line: number; home: number; away: number } | null;
  total?: { line: number; over: number; under: number } | null;
  timestamp?: number;
  source?: string;
};

export function useOdds(marketId?: number | string, options?: { refetchInterval?: number }) {
  const idStr = String(marketId ?? '');
  const query = useQuery({
    enabled: !!idStr,
    queryKey: ['odds', idStr],
    queryFn: async () => {
      const data = await apiFetch<OddsResponse>(`/odds/${idStr}`, {
        timeoutMs: 6000,
        ui: { showLoading: true, toastOnError: true },
      });
      const moneyline = data?.moneyline;
      const home = typeof moneyline?.home === 'number' ? moneyline.home : (typeof data?.odds_a === 'number' ? data.odds_a / 100 : undefined);
      const away = typeof moneyline?.away === 'number' ? moneyline.away : (typeof data?.odds_b === 'number' ? data.odds_b / 100 : undefined);
      const norm: NormalizedOdds = {
        home,
        away,
        spread: data?.spread ?? null,
        total: data?.total ?? null,
        timestamp: data?.timestamp,
        source: data?.source,
      };
      return norm;
    },
    staleTime: 10_000,
    refetchInterval: options?.refetchInterval,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}