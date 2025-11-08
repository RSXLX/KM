'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch, MarketListResponse } from '@/lib/api';

interface UseMarketsOptions { page?: number; pageSize?: number; league?: string; status?: string }

export function useMarkets(options: UseMarketsOptions = {}) {
  const { page = 1, pageSize = 20, league, status } = options;
  const query = useQuery({
    queryKey: ['markets', page, pageSize, league, status],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(league ? { league } : {}),
        ...(status ? { status } : {}),
      }).toString();
      return apiFetch<MarketListResponse>(`/markets?${qs}`);
    },
  });
  return {
    markets: query.data?.items ?? [],
    page: query.data?.page ?? page,
    pageSize: query.data?.pageSize ?? pageSize,
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}