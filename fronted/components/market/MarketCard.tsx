'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useSimpleTranslation } from '@/lib/i18n-simple';
import { Clock, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { Market } from '@/types';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatTimeLeft, formatPercentage } from '@/lib/utils';
import { BetModal } from './BetModal';

interface MarketCardProps {
  market: Market;
  onUpVote: (marketId: string) => void;
  onDownVote: (marketId: string) => void;
  onCardClick: (marketId: string) => void;
}

export function MarketCard({ market, onUpVote, onDownVote, onCardClick }: MarketCardProps) {
  const { t } = useSimpleTranslation();
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<'yes' | 'no'>('yes');

  const handleVoteClick = (outcome: 'yes' | 'no', e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOutcome(outcome);
    setShowBetModal(true);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      crypto: 'bg-orange-500',
      sports: 'bg-green-500',
      politics: 'bg-red-500',
      economy: 'bg-blue-500',
      gaming: 'bg-purple-500',
      culture: 'bg-pink-500',
      tech: 'bg-indigo-500'
    };
    return colors[category] || 'bg-gray-500';
  };

  return (
    <>
      <div 
        className="tech-card group cursor-pointer overflow-hidden transition-all duration-300"
        onClick={() => onCardClick(market.id)}
      >
        {/* Image */}
        <div className="relative h-48 overflow-hidden">
          <Image
            src={market.imageUrl}
            alt={market.title}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
          />
          
          {/* Category Badge */}
          <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium text-white ${getCategoryColor(market.category)}`}>
            {market.category.toUpperCase()}
          </div>

          {/* Time Left Badge */}
          <div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white px-2 py-1 rounded-full text-xs flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{formatTimeLeft(market.endDate)}</span>
          </div>
        </div>

        <div className="p-4">
          {/* Title */}
          <h3 className="font-semibold text-card-foreground mb-3 line-clamp-2 leading-tight">
            {market.title}
          </h3>

          {/* Stats */}
          <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <span className="font-medium">{formatCurrency(market.totalVolume)}</span>
              <span className="text-muted-foreground opacity-70">{t('market.volume')}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{market.participants.toLocaleString()}</span>
            </div>
          </div>

          {/* Probability Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-600 font-medium">YES {formatPercentage(market.probability)}</span>
              <span className="text-red-600 font-medium">NO {formatPercentage(1 - market.probability)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full"
                style={{ 
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${market.probability * 100}%, #ef4444 ${market.probability * 100}%, #ef4444 100%)`
                }}
              />
            </div>
          </div>

          {/* Vote Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="up"
              size="sm"
              className="flex items-center justify-center space-x-1"
              onClick={(e) => handleVoteClick('yes', e)}
            >
              <TrendingUp className="w-4 h-4" />
              <span>YES</span>
              <span className="text-xs opacity-80">{formatPercentage(market.probability)}</span>
            </Button>
            <Button
              variant="down"
              size="sm"
              className="flex items-center justify-center space-x-1"
              onClick={(e) => handleVoteClick('no', e)}
            >
              <TrendingDown className="w-4 h-4" />
              <span>NO</span>
              <span className="text-xs opacity-80">{formatPercentage(1 - market.probability)}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Bet Modal */}
      <BetModal
        isOpen={showBetModal}
        onClose={() => setShowBetModal(false)}
        market={market}
        selectedOutcome={selectedOutcome}
        onBet={(betData) => {
          console.log('Bet placed:', betData);
          setShowBetModal(false);
        }}
      />
    </>
  );
}