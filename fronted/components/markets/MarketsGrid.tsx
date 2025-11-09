'use client';

import { useMarkets } from '@/hooks/useMarkets';
import { MarketCard } from '@/components/market/MarketCard';

export function MarketsGrid() {
  const { markets, isLoading, error } = useMarkets({ limit: 24, trending: true });

  if (isLoading) {
    return <div className="py-10 text-sm text-muted-foreground">加载市场中...</div>;
  }
  if (error) {
    return <div className="py-10 text-sm text-red-500">加载失败：{error}</div>;
  }

  if (!markets.length) {
    return <div className="py-10 text-sm text-muted-foreground">暂无市场数据</div>;
  }

  const handleUp = (id: string) => {};
  const handleDown = (id: string) => {};
  const handleClick = (id: string) => {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {markets.map((m) => (
        <MarketCard
          key={m.id}
          market={m}
          onUpVote={handleUp}
          onDownVote={handleDown}
          onCardClick={handleClick}
        />
      ))}
    </div>
  );
}