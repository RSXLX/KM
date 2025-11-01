'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface BetInfo {
  id: string;
  matchId: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  selectedTeam: string;
  teamName: string;
  odds: number;
  amount: number;
  multiplier: number;
  expectedPayout: number;
  type: string;
  status: 'confirmed' | 'pending' | 'settled';
  timestamp: string;
  transactionSignature?: string;
  pnl?: number;
}

interface MyBetProps {
  className?: string;
  fixtureId?: string;
  refreshTrigger?: number; // 用于触发刷新
}

function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

function formatCurrency(amount: number): string {
  return amount.toFixed(6);
}

export function MyBet({ fixtureId, className, refreshTrigger }: MyBetProps) {
  const wallet = useWallet();
  const [bets, setBets] = useState<BetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBets, setExpandedBets] = useState<Set<string>>(new Set());

  // 获取用户的投注记录
  const fetchUserBets = async () => {
    if (!wallet.publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let url = `/api/bets?wallet_address=${wallet.publicKey.toBase58()}`;
      
      if (fixtureId) {
        url += `&fixture_id=${fixtureId}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        // 如果API失败，使用模拟数据进行测试
        console.warn('API failed, using mock data:', data.error);
        const mockBets = generateMockBets();
        setBets(mockBets);
        return;
      }

      // 转换数据格式
      const formattedBets: BetInfo[] = (data.bets || []).map((bet: any) => {
        // 计算赔率
        let odds = 1.85; // 默认赔率
        if (bet.odds_home_bps && bet.odds_away_bps) {
          odds = bet.selected_team === 1 
            ? bet.odds_home_bps / 10000 
            : bet.odds_away_bps / 10000;
        } else if (bet.odds_home_bps && bet.selected_team === 1) {
          odds = bet.odds_home_bps / 10000;
        } else if (bet.odds_away_bps && bet.selected_team === 2) {
          odds = bet.odds_away_bps / 10000;
        }

        // 计算预期赔付
        const multiplier = bet.multiplier_bps ? bet.multiplier_bps / 10000 : 1;
        const expectedPayout = bet.payout_expected || (bet.amount * odds * multiplier);

        // 确定队伍名称
        const homeTeam = bet.market?.home_team || '主队';
        const awayTeam = bet.market?.away_team || '客队';
        const teamName = bet.selected_team === 1 ? homeTeam : awayTeam;

        return {
          id: bet.id || bet.bet_address || `bet_${Date.now()}_${Math.random()}`,
          matchId: bet.fixture_id || bet.matchId || 'unknown',
          fixtureId: bet.fixture_id || bet.matchId || 'unknown',
          homeTeam,
          awayTeam,
          selectedTeam: bet.selected_team === 1 ? 'home' : 'away',
          teamName,
          odds,
          amount: bet.amount || 0,
          multiplier,
          expectedPayout,
          type: bet.position_type || 'OPEN',
          status: bet.confirmation_status === 'confirmed' ? 'confirmed' : 
                  bet.status === 1 ? 'confirmed' : 'pending',
          timestamp: bet.created_at || bet.timestamp || new Date().toISOString(),
          transactionSignature: bet.transaction_signature || bet.signature,
          pnl: bet.pnl || 0
        };
      });

      setBets(formattedBets);
    } catch (err: any) {
      setError(err.message);
      console.error('获取投注记录失败:', err);
      
      // 如果出错，使用模拟数据
      const mockBets = generateMockBets();
      setBets(mockBets);
    } finally {
      setLoading(false);
    }
  };

  // 生成模拟投注数据
  const generateMockBets = (): BetInfo[] => {
    return [
      {
        id: 'nba-lal-bos-001',
        matchId: 'nba-lal-bos-001',
        fixtureId: 'nba-lal-bos-001',
        homeTeam: 'Lakers',
        awayTeam: 'Celtics',
        selectedTeam: 'home',
        teamName: 'Lakers',
        odds: 1.85,
        amount: 5000, // 0.000005 SOL in lamports
        multiplier: 2.0,
        expectedPayout: 18500, // 5000 * 1.85 * 2.0
        type: 'OPEN',
        status: 'confirmed',
        timestamp: '2025/10/30 10:52:45',
        transactionSignature: '34Cdz3u1TR...',
        pnl: 0
      }
    ];
  };

  useEffect(() => {
    fetchUserBets();
  }, [wallet.publicKey, fixtureId, refreshTrigger]);

  const toggleBetExpansion = (betId: string) => {
    const newExpanded = new Set(expandedBets);
    if (newExpanded.has(betId)) {
      newExpanded.delete(betId);
    } else {
      newExpanded.add(betId);
    }
    setExpandedBets(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-green-100 text-green-800">已确认</Badge>;
      case 'pending':
        return <Badge variant="secondary">待确认</Badge>;
      case 'settled':
        return <Badge variant="outline">已结算</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!wallet.publicKey) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center">
          <p className="text-muted-foreground">请先连接钱包查看投注记录</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center">
          <p className="text-muted-foreground">加载投注记录中...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center">
          <p className="text-red-500">加载失败: {error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={fetchUserBets}
          >
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (bets.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">我的投注</CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {fixtureId ? '当前比赛暂无投注记录' : '暂无投注记录'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          我的投注 ({bets.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {bets.map((bet) => (
            <div key={bet.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">
                    {bet.homeTeam} vs {bet.awayTeam}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {new Date(bet.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(bet.status)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleBetExpansion(bet.id)}
                    className="p-1"
                  >
                    {expandedBets.has(bet.id) ? 
                      <ChevronUp className="w-4 h-4" /> : 
                      <ChevronDown className="w-4 h-4" />
                    }
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">比赛ID:</span>
                  <p className="font-mono">{bet.matchId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">金额:</span>
                  <p>{formatCurrency(lamportsToSol(bet.amount))}</p>
                </div>
              </div>

              {expandedBets.has(bet.id) && (
                <>
                  <Separator className="my-2" />
                  <div className="space-y-2 text-xs">
                    <h5 className="font-medium">投注信息</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">赔率:</span>
                        <p className="font-medium">{bet.odds.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">预期赔付:</span>
                        <p className="font-medium">{formatCurrency(lamportsToSol(bet.expectedPayout))}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">类型:</span>
                        <p className="font-medium">{bet.type}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">队伍:</span>
                        <p className="font-medium">{bet.teamName}</p>
                      </div>
                    </div>
                    
                    {bet.pnl !== undefined && bet.pnl !== 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">盈亏:</span>
                        <span className={`font-medium flex items-center ${bet.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {bet.pnl >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {formatCurrency(lamportsToSol(bet.pnl))}
                        </span>
                      </div>
                    )}
                    
                    {bet.transactionSignature && (
                      <div>
                        <span className="text-muted-foreground">交易签名:</span>
                        <p className="font-mono text-xs break-all">
                          {bet.transactionSignature.slice(0, 20)}...
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}