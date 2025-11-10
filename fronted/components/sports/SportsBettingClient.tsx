'use client';

import React, { useEffect, useState } from 'react';
import { useSportsBetting } from '@/hooks/useSportsBetting';
import { OddsChart } from '@/components/sports/OddsChart';
import { LiveOddsChart } from '@/components/sports/LiveOddsChart';
import { LiveMatchIndicator } from '@/components/sports/LiveMatchIndicator';
import { BetPanel } from '@/components/sports/BetPanel';
import { MatchList } from '@/components/sports/MatchList';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PaymentSuccessModal } from '@/components/ui/PaymentSuccessModal';
import { ConfirmBetModal } from '@/components/sports/ConfirmBetModal';
import { useWallet } from '@solana/wallet-adapter-react';
import { sendWithLedger } from '@/lib/solana-ledger';
import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';

interface SportsBettingClientProps {
  fixtureId?: string;
  isLiveSignal?: boolean;
  onBetSuccess?: () => void;
}

export function SportsBettingClient({ fixtureId, isLiveSignal, onBetSuccess }: SportsBettingClientProps) {
  const {
    matchData,
    chartData,
    liveChartData,
    isLive,
    startLive,
    stopLive,
    generateRandomOdds,
    updateMultiplier,
    updateWagerAmount,
    selectTeam,
    loadFixtureById,
    bets,
    placeBet,
  } = useSportsBetting(fixtureId);

  const wallet = useWallet();
  
  // Loading state for betting operations
  const [isBetting, setIsBetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Payment success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    transactionSignature?: string;
    amount?: number;
    selectedTeam?: string;
    payout?: number;
    network?: string;
  }>({});

  useEffect(() => {
    if (typeof isLiveSignal === 'boolean') {
      if (isLiveSignal && !isLive) startLive();
      if (!isLiveSignal && isLive) stopLive();
    }
    return () => {
      stopLive();
    };
  }, [isLiveSignal]);

  const sampleMatches = [
    { id: '101', teams: { home: 'Lakers', away: 'Celtics' }, odds: { home: 1.8, away: 2.1 } },
    { id: '102', teams: { home: 'Jets', away: 'Bills' }, odds: { home: 1.9, away: 1.95 } },
    { id: '103', teams: { home: 'Arsenal', away: 'Chelsea' }, odds: { home: 2.2, away: 1.7 } }
  ];

  return (
    <div className="min-h-screen text-foreground relative z-[210]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="tech-card mb-4">
          <CardHeader>
            <CardTitle className="text-center text-xl flex items-center justify-center gap-2">
              {isLive ? 'Live In-Play Odds' : 'Pre-Game Betting Odds'}
              <LiveMatchIndicator isLive={isLive} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center gap-8">
              <div className="text-center">
                <div className={`w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-2 mx-auto ${matchData.wager.selectedTeam === 'home' ? 'ring-4 ring-primary' : ''}`}>
                  <span className="text-xl font-bold">{matchData.teams.home.code}</span>
                </div>
                <p className="text-sm text-muted-foreground">{matchData.teams.home.name}</p>
              </div>

              <Separator orientation="vertical" className="h-12" />

              <div className="text-center">
                <p className="text-muted-foreground">vs</p>
              </div>

              <Separator orientation="vertical" className="h-12" />

              <div className="text-center">
                <div className={`w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-2 mx-auto ${matchData.wager.selectedTeam === 'away' ? 'ring-4 ring-secondary' : ''}`}>
                  <span className="text-xl font-bold">{matchData.teams.away.code}</span>
                </div>
                <p className="text-sm text-muted-foreground">{matchData.teams.away.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {isLive ? (
              <LiveOddsChart
                homeCode={matchData.teams.home.code}
                awayCode={matchData.teams.away.code}
                data={liveChartData}
                liquidation={matchData.odds.liquidation}
                selectedTeam={matchData.wager.selectedTeam}
              />
            ) : (
              <OddsChart
                homeCode={matchData.teams.home.code}
                awayCode={matchData.teams.away.code}
                odds={matchData.odds}
                selectedTeam={matchData.wager.selectedTeam}
              />
            )}
          </div>

          <div className="lg:col-span-1">
          <BetPanel
              home={{ code: matchData.teams.home.code, name: matchData.teams.home.name, odds: matchData.odds.home }}
              away={{ code: matchData.teams.away.code, name: matchData.teams.away.name, odds: matchData.odds.away }}
              selectedTeam={matchData.wager.selectedTeam}
              amount={matchData.wager.amount}
              multiplier={matchData.wager.multiplier}
              payout={matchData.wager.payout}
              liquidation={matchData.odds.liquidation}
              onSelectTeam={selectTeam}
              onAmountChange={updateWagerAmount}
              onMultiplierChange={updateMultiplier}
              fixtureId={fixtureId}
              isLoading={isBetting}
              onPlaceBet={async () => {
                // 二次确认弹窗
                setShowConfirm(true);
              }}
            />
          </div>
        </div>

        {/* Match list */}
        <></>
        
        {/* Confirm Bet Modal */}
        <ConfirmBetModal
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          fixtureId={matchData.matchId}
          teamLabel={matchData.wager.selectedTeam === 'home' ? 'Home' : matchData.wager.selectedTeam === 'away' ? 'Away' : '-'}
          teamName={matchData.wager.selectedTeam === 'home' ? matchData.teams.home.name : matchData.wager.selectedTeam === 'away' ? matchData.teams.away.name : '-'}
          teamCode={matchData.wager.selectedTeam === 'home' ? matchData.teams.home.code : matchData.wager.selectedTeam === 'away' ? matchData.teams.away.code : '-'}
          amount={matchData.wager.amount}
          multiplier={matchData.wager.multiplier}
          oddsSelected={matchData.wager.selectedTeam === 'home' ? matchData.odds.home : matchData.wager.selectedTeam === 'away' ? matchData.odds.away : 0}
          payout={matchData.wager.payout}
          onConfirm={async () => {
            setIsBetting(true);
            try {
              const disableLedger = (process.env.NEXT_PUBLIC_DISABLE_LEDGER || 'false') === 'true';
              let signature = `dev_${Date.now()}`;
              let walletAddr = wallet.publicKey?.toBase58() || `dev_wallet_${Date.now()}`;
              if (!disableLedger && wallet.publicKey) {
                // 进行链上记账（Memo），产生交易签名
                const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
                const payload = {
                  type: 'bet',
                  matchId: matchData.matchId,
                  team: matchData.wager.selectedTeam,
                  amount: matchData.wager.amount,
                  multiplier: matchData.wager.multiplier,
                  payout: matchData.wager.payout,
                  ts: Date.now(),
                };
                const data = Buffer.from(JSON.stringify(payload));
                const ix = new TransactionInstruction({ keys: [], programId: memoProgramId, data });
                const tx = new Transaction().add(ix);
                const res = await sendWithLedger(
                  { publicKey: wallet.publicKey!, sendTransaction: wallet.sendTransaction },
                  async () => tx,
                  { reason: 'bet', fixtureId: matchData.matchId }
                );
                signature = res.signature;
                walletAddr = wallet.publicKey!.toBase58();
              }

              // 调用后端开仓，写入数据库
              const selectedTeamNum = matchData.wager.selectedTeam === 'home' ? 1 : 2;
              const multiplierBps = Math.round(matchData.wager.multiplier * 10000);
              const oddsHomeBps = Math.round(matchData.odds.home * 10000);
              const oddsAwayBps = Math.round(matchData.odds.away * 10000);
              const fixtureNumeric = Number(matchData.matchId);
              const marketAddress = matchData.marketAddress || (Number.isFinite(fixtureNumeric) ? `market_${fixtureNumeric}` : `market_${matchData.matchId}`);
              const { apiClient } = await import('@/lib/apiClient');
              const json = await apiClient.post('/api/positions', {
                wallet_address: walletAddr,
                fixture_id: Number.isFinite(fixtureNumeric) ? fixtureNumeric : undefined,
                market_address: marketAddress,
                selected_team: selectedTeamNum,
                amount: matchData.wager.amount,
                multiplier_bps: multiplierBps,
                odds_home_bps: oddsHomeBps,
                odds_away_bps: oddsAwayBps,
                transaction_signature: signature,
              }, { timeoutMs: 10000 });
              if (json?.ok === false) {
                throw new Error(json?.error || 'Backend create position failed');
              }

              // 本地 UI 记录（用于即时反馈）
              placeBet();

              // 展示成功信息
              setSuccessModalData({
                transactionSignature: res.signature,
                amount: matchData.wager.amount,
                selectedTeam: matchData.wager.selectedTeam === 'home'
                  ? matchData.teams.home.name
                  : matchData.teams.away.name,
                payout: matchData.wager.payout,
                network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet'
              });
              setShowSuccessModal(true);

              // 外部回调：刷新列表/统计
              onBetSuccess?.();
            } catch (e: any) {
              console.error('place bet failed:', e);
              alert('Place bet failed: ' + (e?.message || 'unknown error'));
            } finally {
              setIsBetting(false);
            }
          }}
        />

        {/* Payment Success Modal */}
        <PaymentSuccessModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          transactionSignature={successModalData.transactionSignature}
          amount={successModalData.amount}
          selectedTeam={successModalData.selectedTeam}
          payout={successModalData.payout}
          network={successModalData.network}
        />
      </div>
    </div>
  );
}