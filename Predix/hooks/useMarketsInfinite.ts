'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { MarketListResponse, MarketListItem } from '@/lib/api';

export function useMarketsInfinite(options?: { pageSize?: number; league?: string; status?: string }) {
  const pageSize = options?.pageSize ?? 20;
  const league = options?.league;
  const status = options?.status;

  const query = useInfiniteQuery({
    queryKey: ['markets-infinite', { pageSize, league, status }],
    queryFn: async ({ pageParam = 1 }) => {
      const qs = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(pageSize),
        ...(league ? { league } : {}),
        ...(status ? { status } : {}),
      }).toString();
      const resp = await apiFetch<MarketListResponse>(`/markets?${qs}`, { timeoutMs: 8000, ui: { showLoading: true, toastOnError: true } });
      return resp;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0);
      if (loaded < (lastPage?.total ?? 0)) {
        return (allPages.length + 1);
      }
      return undefined;
    },
    staleTime: 30_000,
    retry: 2,
  });

  const items: MarketListItem[] = (query.data?.pages ?? []).flatMap(p => p.items ?? []);
  return {
    items,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}