'use client';

import React, { useEffect, useState } from 'react';
import { useSportsBetting } from '@/hooks/useSportsBetting';
import { useActiveMarkets } from '@/hooks/useActiveMarkets';
import { useOdds } from '@/hooks/useOdds';
import dynamic from 'next/dynamic';
const OddsChart = dynamic(() => import('@/components/sports/OddsChart').then(m => m.OddsChart), { ssr: false });
const LiveOddsChart = dynamic(() => import('@/components/sports/LiveOddsChart').then(m => m.LiveOddsChart), { ssr: false });
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

  // Integrate active markets + odds data flow
  const { data: activeList, isLoading: isActiveLoading, error: activeError } = useActiveMarkets({ forceRefresh: true });
  // Choose marketId: prefer fixtureId, else first active market
  const selectedMarketId: string | undefined = (() => {
    if (fixtureId) {
      // Try match by string equality or numeric parse
      const found = (activeList || []).find(m => String(m.market_id) === String(fixtureId));
      if (found) return String(found.market_id);
      const n = parseInt(String(fixtureId), 10);
      if (!Number.isNaN(n)) return String(n);
      return String(fixtureId);
    }
    const first = (activeList || [])[0];
    return first ? String(first.market_id) : undefined;
  })();
  const { data: oddsData, isLoading: isOddsLoading } = useOdds(selectedMarketId, { refetchInterval: 5000 });

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
    // Keep match data aligned with selected market
    if (selectedMarketId && String(matchData.matchId) !== String(selectedMarketId)) {
      loadFixtureById(selectedMarketId);
    }
    if (typeof isLiveSignal === 'boolean') {
      if (isLiveSignal && !isLive) startLive();
      if (!isLiveSignal && isLive) stopLive();
    }
    return () => {
      stopLive();
    };
  }, [isLiveSignal, selectedMarketId]);

  const sampleMatches = [
    { id: '101', teams: { home: 'Lakers', away: 'Celtics' }, odds: { home: 1.8, away: 2.1 } },
    { id: '102', teams: { home: 'Jets', away: 'Bills' }, odds: { home: 1.9, away: 1.95 } },
    { id: '103', teams: { home: 'Arsenal', away: 'Chelsea' }, odds: { home: 2.2, away: 1.7 } }
  ];

  // Display odds: prefer hook odds, fallback to local matchData odds
  const displayOdds = {
    home: oddsData?.home ?? matchData.odds.home,
    away: oddsData?.away ?? matchData.odds.away,
    liquidation: matchData.odds.liquidation,
  };

  return (
    <div className="text-foreground">
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
                liquidation={displayOdds.liquidation}
                selectedTeam={matchData.wager.selectedTeam}
              />
            ) : (
              <OddsChart
                homeCode={matchData.teams.home.code}
                awayCode={matchData.teams.away.code}
                odds={displayOdds}
                selectedTeam={matchData.wager.selectedTeam}
              />
            )}
          </div>

          <div className="lg:col-span-1">
            <BetPanel
              home={{ code: matchData.teams.home.code, name: matchData.teams.home.name, odds: displayOdds.home }}
              away={{ code: matchData.teams.away.code, name: matchData.teams.away.name, odds: displayOdds.away }}
              selectedTeam={matchData.wager.selectedTeam}
              amount={matchData.wager.amount}
              multiplier={matchData.wager.multiplier}
              payout={matchData.wager.payout}
              liquidation={displayOdds.liquidation}
              onSelectTeam={selectTeam}
              onAmountChange={updateWagerAmount}
              onMultiplierChange={updateMultiplier}
              fixtureId={fixtureId}
              isLoading={isBetting || isActiveLoading || isOddsLoading}
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