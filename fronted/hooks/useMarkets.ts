'use client';

import { useState, useEffect } from 'react';
import { Market } from '@/types';
import apiClient from '@/lib/apiClient';

interface UseMarketsOptions {
  category?: string;
  limit?: number;
  trending?: boolean;
}

export function useMarkets(options: UseMarketsOptions = {}) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const fetchMarkets = async () => {
      try {
        setIsLoading(true);
        // 后端兼容接口
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
        const json = await apiClient.get(`/compat/markets`, {
          baseUrl: base,
          query: { page: 1, limit: options.limit ?? 20 },
          timeoutMs: 10000,
          signal: controller.signal,
        });
        const list: any[] = json?.data ?? [];

        // 映射为 UI 层 Market
        const mapped: Market[] = list.map((m) => {
          // 概率估算：基于bps
          const home = Number(m?.odds_home_bps ?? 0);
          const away = Number(m?.odds_away_bps ?? 0);
          const denom = home + away;
          const prob = denom > 0 ? home / denom : 0.5;
          const title = m?.home_name && m?.away_name
            ? `${m.home_name} vs ${m.away_name}`
            : `Market #${m.id}`;
          const endDate = m?.close_time ? new Date(m.close_time) : (m?.start_time ? new Date(m.start_time) : new Date());
          const resolved = Number(m?.state) === 3;
          const imageUrl = 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400';
          const category = 'sports';
          const totalVolume = Number(m?.total_volume ?? 0);
          const participants = Number(m?.total_bets ?? 0);
          return {
            id: String(m?.id ?? ''),
            title,
            description: `${m?.home_name ?? 'Home'} vs ${m?.away_name ?? 'Away'}`,
            imageUrl,
            category,
            endDate,
            resolved,
            totalVolume,
            participants,
            probability: prob,
            upPercentage: Math.round(prob * 100),
            downPercentage: Math.round((1 - prob) * 100),
            creator: m?.market_address ?? 'on-chain',
            createdAt: new Date(m?.created_at ?? Date.now()),
            updatedAt: new Date(m?.updated_at ?? Date.now()),
            source: 'compat',
            sourceUrl: undefined,
          } as Market;
        });

        // Filter by category if specified
        let filteredMarkets = mapped;
        if (options.category) {
          filteredMarkets = mapped.filter(market => market.category === options.category);
        }

        // Sort by trending if specified
        if (options.trending) {
          filteredMarkets.sort((a, b) => b.totalVolume - a.totalVolume);
        }

        if (!cancelled) {
          setMarkets(filteredMarkets);
          setError(null);
        }
      } catch (err) {
        const isAbort = (err as any)?.name === 'AbortError';
        if (!cancelled && !isAbort) {
          setError(err instanceof Error ? err.message : 'Failed to fetch markets');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchMarkets();
    return () => { cancelled = true; controller.abort(); };
  }, [options.category, options.limit, options.trending]);

  return { markets, isLoading, error };
}