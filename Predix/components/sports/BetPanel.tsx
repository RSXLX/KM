'use client';

import React, { useEffect, useState } from 'react';

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ClosePositionModal } from './ClosePositionModal';
import { Loader2 } from 'lucide-react';

interface BetPanelProps {
  home: { code: string; name: string; odds: number };
  away: { code: string; name: string; odds: number };
  selectedTeam: 'home' | 'away' | null;
  amount: number;
  multiplier: number;
  payout: number;
  liquidation: number;
  onSelectTeam: (team: 'home' | 'away') => void;
  onAmountChange: (amount: number) => void;
  onMultiplierChange: (multiplier: number) => void;
  onPlaceBet?: () => Promise<void>;
  fixtureId?: string; // 添加fixtureId属性用于平仓功能
  isLoading?: boolean; // 添加加载状态
}

export function BetPanel({
  home,
  away,
  selectedTeam,
  amount,
  multiplier,
  payout,
  liquidation,
  onSelectTeam,
  onAmountChange,
  onMultiplierChange,
  onPlaceBet,
  fixtureId,
  isLoading = false
}: BetPanelProps) {
  const HOME_COLOR = '#6A4BFF';
  const AWAY_COLOR = '#00E0A8';

  // Keep input as string so it can be empty and fully cleared
  const [amountInput, setAmountInput] = useState<string>('');
  useEffect(() => {
    setAmountInput(amount > 0 ? String(amount) : '');
  }, [amount]);

  return (
    <Card className="tech-card">
      <CardHeader>
        <CardTitle className="text-center text-lg">Place Your Bet</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Button
            variant={'outline'}
            className={`p-4 rounded-lg border-2 w-full border-[#6A4BFF] ${selectedTeam === 'home' ? 'bg-[#6A4BFF]/10' : 'hover:bg-[#6A4BFF]/10'}`}
            onClick={() => onSelectTeam('home')}
          >
            <div className="w-full text-center">
              <p className="font-bold text-lg">{home.code}</p>
              <p className={`text-2xl font-bold ${selectedTeam === 'home' ? 'text-foreground' : 'text-[#6A4BFF]'}`}>{home.odds}</p>
              <p className="text-muted-foreground text-sm">{home.name}</p>
            </div>
          </Button>

          <Button
            variant={'outline'}
            className={`p-4 rounded-lg border-2 w-full border-[#00E0A8] ${selectedTeam === 'away' ? 'bg-[#00E0A8]/10' : 'hover:bg-[#00E0A8]/10'}`}
            onClick={() => onSelectTeam('away')}
          >
            <div className="w-full text-center">
              <p className="font-bold text-lg">{away.code}</p>
              <p className={`text-2xl font-bold ${selectedTeam === 'away' ? 'text-foreground' : 'text-[#00E0A8]'}`}>{away.odds}</p>
              <p className="text-muted-foreground text-sm">{away.name}</p>
            </div>
          </Button>
        </div>

        <Separator className="my-3" />

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Wager Amount</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={amountInput}
              onChange={(e) => {
                const v = e.target.value;
                setAmountInput(v);
                const num = v === '' ? 0 : parseFloat(v);
                onAmountChange(Number.isNaN(num) ? 0 : num);
              }}
              placeholder="Enter amount"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">Multiplier: {multiplier}x</label>
            <input
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={multiplier}
              onChange={(e) => onMultiplierChange(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="mt-2 text-xs text-levr-red">Liquidation: {liquidation}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-2">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Estimated Payout</p>
          <p className="text-2xl font-bold text-primary">${payout.toFixed(2)}</p>
        </div>
        
        <div className="w-full space-y-2">
          <Button
            className={`w-full ${selectedTeam === 'home' ? 'bg-[#6A4BFF] text-white hover:opacity-90' : selectedTeam === 'away' ? 'bg-[#00E0A8] text-white hover:opacity-90' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
            disabled={!selectedTeam || amount <= 0 || isLoading}
            onClick={onPlaceBet ? onPlaceBet : () => console.log('Place Bet', { selectedTeam, amount, multiplier, payout })}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Handling
              </>
            ) : (
              'Place Bet'
            )}
          </Button>
          
          {/* 平仓按钮 */}
          <ClosePositionModal 
            fixtureId={fixtureId}
            trigger={
              <Button 
                className="w-full"
              >
                Close position
              </Button>
            }
          />
        </div>
      </CardFooter>
    </Card>
  );
}