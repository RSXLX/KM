'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import React, { createContext, useContext } from 'react';

export type ActiveMarket = { market_id: number; title: string; category: string };
export type ActiveMarketsResp = { source: string; data: ActiveMarket[] };

type CacheCtx = { list?: ActiveMarket[] };
const Ctx = createContext<CacheCtx | null>(null);

export function ActiveMarketsProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={{}}>{children}</Ctx.Provider>;
}

export function useActiveMarkets(options?: { forceRefresh?: boolean }) {
  const forceRefresh = options?.forceRefresh ?? false;
  const query = useQuery({
    queryKey: ['active-markets', { forceRefresh }],
    queryFn: async () => {
      const qs = new URLSearchParams({ forceRefresh: String(forceRefresh) });
      const data = await apiFetch<ActiveMarketsResp>(`/markets/active?${qs.toString()}`, {
        timeoutMs: 6000,
        ui: { showLoading: true, toastOnError: true },
      });
      return data.data ?? [];
    },
    staleTime: 30_000,
    retry: 2,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}