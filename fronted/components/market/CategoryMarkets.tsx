'use client';

import { useState } from 'react';
import { Filter, ArrowUpDown } from 'lucide-react';
import { useMarkets } from '@/hooks/useMarkets';
import { MarketCard } from './MarketCard';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CategoryMarketsProps {
  category: string;
}

export function CategoryMarkets({ category }: CategoryMarketsProps) {
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'ending'>('newest');
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'resolved'>('all');

  const { markets, isLoading, error } = useMarkets({ 
    category,
    trending: sortBy === 'popular'
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-8">
        <p>Error loading markets: {error}</p>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p className="text-lg mb-4">No markets found in this category</p>
        <p className="text-sm">Check back later for new prediction markets!</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters and Sort */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            {markets.length} markets
          </span>
          
          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center space-x-2">
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterBy('all')}>
                All Markets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterBy('active')}>
                Active Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterBy('resolved')}>
                Resolved Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center space-x-2">
                <ArrowUpDown className="w-4 h-4" />
                <span>Sort</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy('newest')}>
                Newest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('popular')}>
                Most Popular
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('ending')}>
                Ending Soon
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Markets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

      {/* Load More Button */}
      {markets.length >= 20 && (
        <div className="text-center mt-8">
          <Button variant="outline" size="lg">
            Load More Markets
          </Button>
        </div>
      )}
    </div>
  );
}