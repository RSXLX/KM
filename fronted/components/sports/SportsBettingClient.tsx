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
    <div className="min-h-screen text-foreground">
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
                setIsBetting(true);
                try {
                  // Keep local UI record
                  const result = placeBet();

                  // Ensure wallet is connected
                  if (!wallet.publicKey) {
                    try { await wallet.connect?.(); } catch {}
                  }
                  if (!wallet.publicKey) {
                    alert('Please connect your Solana wallet.');
                    return;
                  }

                  // Build a minimal memo transaction to incur fee and record bet meta
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
                  console.log('Bet ledger recorded:', res);
                  
                  // Show success modal with transaction details
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
                  
                  // 调用成功回调，触发数据刷新
                  onBetSuccess?.();
                } catch (e: any) {
                  console.error('sendWithLedger failed:', e);
                  alert('Transaction failed: ' + (e?.message || 'unknown error'));
                } finally {
                  setIsBetting(false);
                }
              }}
            />
          </div>
        </div>

        {/* Match list */}
        <></>
        
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