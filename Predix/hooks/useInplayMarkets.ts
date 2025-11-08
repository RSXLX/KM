'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type InPlayItem = {
  market_id: number;
  title: string;
  category: string;
  status: {
    isLive: boolean;
    phase?: string;
    minute?: number;
    second?: number;
    period?: number;
    time: string;
  };
  score: { home: number; away: number };
  moneyline?: { home: number; away: number } | null;
  timestamp: number;
  source: string;
};

export function useInplayMarkets() {
  const query = useQuery({
    queryKey: ['inplay-markets'],
    queryFn: async () => {
      const resp = await apiFetch<{ items: InPlayItem[] }>(`/markets/inplay`, {
        timeoutMs: 6000,
        ui: { showLoading: true, toastOnError: true },
      });
      return resp.items ?? [];
    },
    staleTime: 10_000,
    retry: 2,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}