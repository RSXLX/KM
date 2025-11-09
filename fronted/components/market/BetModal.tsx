'use client';

import { useState } from 'react';
import { useSimpleTranslation } from '@/lib/i18n-simple';
import { X, TrendingUp, TrendingDown, Clock, Users, ExternalLink } from 'lucide-react';
import { Market } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatTimeLeft, formatPercentage } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: Market;
  selectedOutcome: 'yes' | 'no';
  onBet: (betData: { marketId: string; outcome: 'yes' | 'no'; amount: string }) => void;
}

export function BetModal({ isOpen, onClose, market, selectedOutcome, onBet }: BetModalProps) {
  const { t } = useSimpleTranslation();
  const [betAmount, setBetAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentPrice = selectedOutcome === 'yes' ? market.probability : (1 - market.probability);
  const potentialReturn = betAmount ? (parseFloat(betAmount) / currentPrice) : 0;
  const profit = potentialReturn - parseFloat(betAmount || '0');

  const handleBet = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0) return;
    
    setIsLoading(true);
    try {
      await onBet({
        marketId: market.id,
        outcome: selectedOutcome,
        amount: betAmount
      });
    } catch (error) {
      console.error('Bet failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end"
          onClick={handleOverlayClick}
        >
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="w-96 h-full bg-background shadow-xl overflow-y-auto "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-background  p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">{t('bet.placeBet')}</h2>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Market Info */}
            <div className="p-6 ">
              <div className="relative h-32 rounded-lg overflow-hidden mb-4">
                <img
                  src={market.imageUrl}
                  alt={market.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-end">
                  <div className="p-4 text-white">
                    <h3 className="font-semibold line-clamp-2">{market.title}</h3>
                  </div>
                </div>
              </div>

              {/* Market Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(market.totalVolume, '')}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('bet.volume')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground flex items-center justify-center">
                    <Users className="w-5 h-5 mr-1" />
                    {market.participants}
                  </div>
                  <div className="text-sm text-muted-foreground">Participants</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground flex items-center justify-center">
                    <Clock className="w-5 h-5 mr-1" />
                    {formatTimeLeft(market.endDate).split(' ')[0]}
                  </div>
                  <div className="text-sm text-muted-foreground">Time Left</div>
                </div>
              </div>
            </div>

            {/* Bet Selection */}
            <div className="p-6 ">
              <h3 className="font-medium mb-4 text-foreground">Select Outcome</h3>
              <div className="grid grid-cols-2 gap-3">
                <div 
                  className={`p-4 rounded-lg  cursor-pointer transition-all ${
                    selectedOutcome === 'yes' 
                      ? ' bg-green-500/10' 
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="font-medium">YES</span>
                    </div>
                    <span className="text-green-600 font-bold">
                      {formatPercentage(market.probability)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Price: ${currentPrice.toFixed(3)}
                  </div>
                </div>

                <div 
                  className={`p-4 rounded-lg  cursor-pointer transition-all ${
                    selectedOutcome === 'no' 
                      ? ' bg-red-500/10' 
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                      <span className="font-medium">NO</span>
                    </div>
                    <span className="text-red-600 font-bold">
                      {formatPercentage(1 - market.probability)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Price: ${(1 - currentPrice).toFixed(3)}
                  </div>
                </div>
              </div>
            </div>

            {/* Bet Amount */}
            <div className="p-6 ">
              <h3 className="font-medium mb-4 text-foreground">{t('bet.amount')}</h3>
              <div className="space-y-4">
                <div>
                  <Input
                    type="number"
                    placeholder="Enter amount in USDC"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="text-lg"
                  />
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[10, 25, 50, 100].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount(amount.toString())}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Expected Returns */}
            {betAmount && parseFloat(betAmount) > 0 && (
              <div className="p-6  bg-muted/30">
                <h3 className="font-medium mb-4 text-foreground">{t('bet.expectedReturn')}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your bet:</span>
                    <span className="font-medium text-foreground">{formatCurrency(parseFloat(betAmount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Potential return:</span>
                    <span className="font-medium text-foreground">{formatCurrency(potentialReturn)}</span>
                  </div>
                  <div className="flex justify-between pt-3">
                    <span className="text-muted-foreground">Potential profit:</span>
                    <span className={`font-bold ${profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(profit)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Market Details */}
            <div className="p-6 bg-muted/30">
              <h3 className="font-medium mb-4 text-foreground">Market Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Description:</span>
                  <p className="mt-1 text-foreground">{market.description}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">End Date:</span>
                  <p className="mt-1 text-foreground">{market.endDate.toLocaleDateString()}</p>
                </div>
                {market.sourceUrl && (
                  <div>
                    <span className="text-muted-foreground">Source:</span>
                    <a 
                      href={market.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center text-primary hover:text-primary/80"
                    >
                      View source <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-background  p-6">
              <Button
                onClick={handleBet}
                disabled={!betAmount || parseFloat(betAmount) <= 0 || isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? 'Placing Bet...' : `Place ${selectedOutcome.toUpperCase()} Bet`}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                By betting, you agree to our Terms of Service
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}