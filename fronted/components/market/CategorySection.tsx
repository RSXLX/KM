'use client';

import { ChevronRight } from 'lucide-react';
import { useMarkets } from '@/hooks/useMarkets';
import { MarketCard } from './MarketCard';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LiveInPlayGrid } from '@/components/sports/LiveInPlayGrid';

interface CategorySectionProps {
  category: string;
  title: string;
  icon: string;
  color: string;
}

export function CategorySection({ category, title, icon, color }: CategorySectionProps) {
  const { markets, isLoading, error } = useMarkets({ 
    category, 
    limit: 8 
  });

  if (isLoading) {
    return (
      <div className="tech-card">
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || markets.length === 0) {
    return null;
  }

  return (
    <div id={`category-${category}`} className="tech-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
            style={{ backgroundColor: color }}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{markets.length} active markets</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          onClick={() => {
            const element = document.getElementById(`category-${category}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className="flex items-center space-x-1"
        >
          <span>View All</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* In-Play for Sports Category */}
      {category === 'sports' && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-foreground mb-2">In-Play Now</h4>
          <LiveInPlayGrid />
        </div>
      )}

      {/* Horizontal Scrolling Cards */}
      <div className="overflow-x-auto pb-4">
        <div className="flex space-x-4 min-w-max">
          {markets.map((market) => (
            <div key={market.id} className="flex-shrink-0 w-80">
              <MarketCard
                market={market}
                onUpVote={(marketId) => console.log('Up vote:', marketId)}
                onDownVote={(marketId) => console.log('Down vote:', marketId)}
                onCardClick={(marketId) => console.log('Card click:', marketId)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicators for mobile */}
      <div className="flex justify-center space-x-1 mt-4 lg:hidden">
        {Array.from({ length: Math.ceil(markets.length / 2) }).map((_, index) => (
          <div
            key={index}
            className="w-2 h-2 rounded-full bg-muted-foreground/50"
          />
        ))}
      </div>
    </div>
  );
}