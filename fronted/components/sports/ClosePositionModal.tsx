'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Clock,
  DollarSign,
  X,
  Loader2
} from 'lucide-react';

interface Position {
  id: number;
  wallet_address: string;
  market_address: string;
  bet_address?: string;
  selected_team: number;
  amount: number;
  multiplier_bps: number;
  payout_expected: number;
  status: number;
  pnl: number;
  fee_paid: number;
  timestamp: string;
  created_at: string;
  transaction_signature?: string;
  market?: {
    fixture_id: string;
    home_team: string;
    away_team: string;
    status: number;
  };
}

interface ClosePositionModalProps {
  marketAddress?: string;
  fixtureId?: string;
  trigger?: React.ReactNode;
  onPositionClosed?: () => void;
}

function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

function bpsToMultiplier(bps: number): number {
  return bps / 10000;
}

export function ClosePositionModal({ 
  marketAddress, 
  fixtureId, 
  trigger,
  onPositionClosed 
}: ClosePositionModalProps) {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closingPosition, setClosingPosition] = useState<number | null>(null);
  const [closePrice, setClosePrice] = useState('');

  // 获取用户的开仓持仓
  const fetchOpenPositions = async () => {
    if (!wallet.publicKey || !open) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let url = `/api/positions?wallet_address=${wallet.publicKey.toBase58()}&status=1&position_type=OPEN`;
      
      if (marketAddress) {
        url += `&market_address=${marketAddress}`;
      }
      
      const { apiClient } = await import('@/lib/apiClient');
      const data = await apiClient.get(url, { timeoutMs: 10000 });
      
      if (!response.ok) {
        throw new Error(data.error || '获取持仓数据失败');
      }
      
      setPositions(data.positions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenPositions();
  }, [wallet.publicKey, open, marketAddress]);

  // 处理平仓
  const handleClosePosition = async (positionId: number) => {
    if (!wallet.publicKey) return;
    
    setClosingPosition(positionId);
    setError(null);
    
    try {
      const { apiClient } = await import('@/lib/apiClient');
      const data = await apiClient.post('/api/positions/close', {
        position_id: positionId,
        wallet_address: wallet.publicKey.toBase58(),
        close_price: closePrice ? parseFloat(closePrice) * 1_000_000_000 : null,
      }, { timeoutMs: 12000 });
      
      if (!data || data.ok === false) {
        throw new Error((data && data.error) || '平仓失败');
      }

      // 刷新持仓数据
      await fetchOpenPositions();
      
      // 重置状态
      setClosePrice('');
      
      // 通知父组件
      onPositionClosed?.();
      
      // 如果没有更多持仓，关闭模态框
      if (positions.length <= 1) {
        setOpen(false);
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClosingPosition(null);
    }
  };

  const renderPositionCard = (position: Position) => (
    <Card key={position.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="font-medium">
              {position.market?.home_team} vs {position.market?.away_team}
            </h4>
            <p className="text-sm text-muted-foreground">
              选择: {position.selected_team === 1 ? position.market?.home_team : position.market?.away_team}
            </p>
          </div>
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            持仓中
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">下注金额</p>
            <p className="font-medium">{lamportsToSol(position.amount).toFixed(4)} SOL</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">杠杆倍数</p>
            <p className="font-medium">{bpsToMultiplier(position.multiplier_bps)}x</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">预期收益</p>
            <p className="font-medium">{lamportsToSol(position.payout_expected).toFixed(4)} SOL</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">当前盈亏</p>
            <p className={`font-medium flex items-center ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {position.pnl >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {lamportsToSol(position.pnl).toFixed(4)} SOL
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mb-3">
          创建时间: {new Date(position.created_at).toLocaleString()}
        </div>

        <Separator className="mb-3" />

        <div className="space-y-3">
          <div>
            <Label htmlFor={`closePrice-${position.id}`} className="text-sm">
              平仓价格 (SOL, 可选)
            </Label>
            <Input
              id={`closePrice-${position.id}`}
              type="number"
              step="0.0001"
              placeholder="留空使用市场价格"
              value={closePrice}
              onChange={(e) => setClosePrice(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              留空将使用当前市场价格进行平仓
            </p>
          </div>

          <Button 
            onClick={() => handleClosePosition(position.id)}
            disabled={closingPosition === position.id}
            className="w-full"
            variant="destructive"
          >
            {closingPosition === position.id ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              '确认平仓'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (!wallet.publicKey) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              平仓
            </Button>
          )}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>平仓管理</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">请先连接钱包</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <X className="w-4 h-4 mr-1" />
            平仓
          </Button>
        )}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="z-[115]" />
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[120]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            平仓管理
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-muted-foreground">加载持仓数据中...</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">暂无持仓</h3>
              <p className="text-muted-foreground">
                {marketAddress ? '当前比赛暂无持仓' : '您暂时没有任何持仓'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  找到 {positions.length} 个持仓
                </h3>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {positions.map(renderPositionCard)}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}