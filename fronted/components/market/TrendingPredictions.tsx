'use client';

import { useMarkets } from '@/hooks/useMarkets';
import { MarketCard } from './MarketCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function TrendingPredictions() {
  const { markets, isLoading, error } = useMarkets({ 
    trending: true, 
    limit: 5 
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-4">
        Error loading trending predictions: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {markets.map((market) => (
        <MarketCard
          key={market.id}
          market={market}
          onUpVote={(marketId) => console.log('Up vote:', marketId)}
          onDownVote={(marketId) => console.log('Down vote:', marketId)}
          onCardClick={(marketId) => console.log('Card click:', marketId)}
        />
      ))}
    </div>
  );
}