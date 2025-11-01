'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Position {
  id: number;
  wallet_address: string;
  market_address: string;
  bet_address?: string;
  position_type: 'OPEN' | 'CLOSE';
  selected_team: number;
  amount: number;
  multiplier_bps: number;
  odds_home_bps?: number;
  odds_away_bps?: number;
  payout_expected: number;
  status: number;
  is_claimed: boolean;
  pnl: number;
  fee_paid: number;
  close_price?: number;
  close_pnl?: number;
  timestamp: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  transaction_signature?: string;
  confirmation_status: string;
  market?: {
    fixture_id: string;
    home_team: string;
    away_team: string;
    status: number;
  };
}

interface UserStats {
  total_positions: number;
  open_positions: number;
  closed_positions: number;
  won_positions: number;
  lost_positions: number;
  total_volume: number;
  total_pnl: number;
  total_fees_paid: number;
  win_rate: number;
}

const STATUS_LABELS = {
  1: '已下注',
  2: '已结算(赢)',
  3: '已结算(输)',
  4: '已取消',
  5: '已退款',
  6: '提前平仓'
};

const STATUS_COLORS = {
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-green-100 text-green-800',
  3: 'bg-red-100 text-red-800',
  4: 'bg-gray-100 text-gray-800',
  5: 'bg-yellow-100 text-yellow-800',
  6: 'bg-purple-100 text-purple-800'
};

function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

function bpsToMultiplier(bps: number): number {
  return bps / 10000;
}

export default function PositionsPage() {
  const wallet = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closingPosition, setClosingPosition] = useState<number | null>(null);
  const [closePrice, setClosePrice] = useState('');

  // 获取持仓数据
  const fetchPositions = async () => {
    if (!wallet.publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/positions?wallet_address=${wallet.publicKey.toBase58()}&limit=100`);
      const data = await response.json();
      
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

  // 获取用户统计
  const fetchUserStats = async () => {
    if (!wallet.publicKey) return;
    
    try {
      const response = await fetch(`/api/users/stats?wallet_address=${wallet.publicKey.toBase58()}`);
      const data = await response.json();
      
      if (response.ok) {
        setUserStats(data.stats);
      }
    } catch (err) {
      console.error('获取用户统计失败:', err);
    }
  };

  useEffect(() => {
    fetchPositions();
    fetchUserStats();
  }, [wallet.publicKey]);

  // 处理平仓
  const handleClosePosition = async (positionId: number) => {
    if (!wallet.publicKey) return;
    
    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          position_id: positionId,
          wallet_address: wallet.publicKey.toBase58(),
          close_price: closePrice ? parseFloat(closePrice) * 1_000_000_000 : null, // 转换为lamports
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '平仓失败');
      }

      // 刷新数据
      await fetchPositions();
      await fetchUserStats();
      
      setClosingPosition(null);
      setClosePrice('');
      
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 分离开仓和平仓记录
  const { openPositions, closedPositions } = useMemo(() => {
    const open = positions.filter(p => p.position_type === 'OPEN' && p.status === 1);
    const closed = positions.filter(p => p.position_type === 'CLOSE' || p.status !== 1);
    return { openPositions: open, closedPositions: closed };
  }, [positions]);

  const renderPositionCard = (position: Position, showCloseButton = false) => (
    <Card key={position.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold">
              {position.market?.home_team} vs {position.market?.away_team}
            </h3>
            <p className="text-sm text-muted-foreground">
              选择: {position.selected_team === 1 ? position.market?.home_team : position.market?.away_team}
            </p>
          </div>
          <Badge className={STATUS_COLORS[position.status as keyof typeof STATUS_COLORS]}>
            {STATUS_LABELS[position.status as keyof typeof STATUS_LABELS]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
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
            <p className="text-xs text-muted-foreground">盈亏</p>
            <p className={`font-medium flex items-center ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {position.pnl >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {lamportsToSol(position.pnl).toFixed(4)} SOL
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>创建时间: {new Date(position.created_at).toLocaleString()}</span>
          {position.transaction_signature && (
            <a 
              href={`https://explorer.solana.com/tx/${position.transaction_signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              查看交易
            </a>
          )}
        </div>

        {showCloseButton && position.status === 1 && (
          <div className="mt-3 pt-3 border-t">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setClosingPosition(position.id)}>
                  平仓
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>平仓确认</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      确认要平仓此持仓吗？
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="text-sm">
                        <strong>比赛:</strong> {position.market?.home_team} vs {position.market?.away_team}
                      </p>
                      <p className="text-sm">
                        <strong>下注金额:</strong> {lamportsToSol(position.amount).toFixed(4)} SOL
                      </p>
                      <p className="text-sm">
                        <strong>当前盈亏:</strong> 
                        <span className={position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {lamportsToSol(position.pnl).toFixed(4)} SOL
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="closePrice">平仓价格 (SOL, 可选)</Label>
                    <Input
                      id="closePrice"
                      type="number"
                      step="0.0001"
                      placeholder="留空使用市场价格"
                      value={closePrice}
                      onChange={(e) => setClosePrice(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      留空将使用当前市场价格进行平仓
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setClosingPosition(null)}>
                      取消
                    </Button>
                    <Button 
                      onClick={() => handleClosePosition(position.id)}
                      disabled={closingPosition === position.id}
                    >
                      {closingPosition === position.id ? '处理中...' : '确认平仓'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!wallet.publicKey) {
    return (
      <ResponsiveLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">请连接钱包</h2>
              <p className="text-muted-foreground">
                连接钱包后即可查看您的持仓记录和交易历史
              </p>
            </CardContent>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="p-6 space-y-6">
        {/* 用户统计 */}
        {userStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                交易统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{userStats.total_positions}</p>
                  <p className="text-sm text-muted-foreground">总持仓数</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{userStats.won_positions}</p>
                  <p className="text-sm text-muted-foreground">盈利次数</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{(userStats.win_rate * 100).toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">胜率</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${userStats.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {lamportsToSol(userStats.total_pnl).toFixed(4)} SOL
                  </p>
                  <p className="text-sm text-muted-foreground">总盈亏</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 持仓标签页 */}
        <Tabs defaultValue="open" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="open" className="flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              持仓中 ({openPositions.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              交易历史 ({closedPositions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>当前持仓</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground">加载中...</p>
                ) : openPositions.length === 0 ? (
                  <p className="text-center text-muted-foreground">暂无持仓</p>
                ) : (
                  <div className="space-y-4">
                    {openPositions.map(position => renderPositionCard(position, true))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>交易历史</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground">加载中...</p>
                ) : closedPositions.length === 0 ? (
                  <p className="text-center text-muted-foreground">暂无交易历史</p>
                ) : (
                  <div className="space-y-4">
                    {closedPositions.map(position => renderPositionCard(position, false))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ResponsiveLayout>
  );
}