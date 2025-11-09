'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SolanaMetrics {
  signature?: string;
  explorerUrl?: string;
  confirmMs?: number;
  feeLamports?: number | null;
  slot?: number | null;
  payloadBytes?: number;
}

interface SolanaInfo {
  balanceSol?: string;
  slot?: number;
  blockhash?: string;
}

interface SolanaActionsProps {
  onConnectWallet?: () => void;
  onSubmitMemo?: () => void;
  onSubmitAnchor?: () => void;
  onFetchBet?: () => void;
  onFetchInfo?: () => void;
  metrics?: SolanaMetrics | null;
  info?: SolanaInfo | null;
}

export function SolanaActions({
  onConnectWallet,
  onSubmitMemo,
  onSubmitAnchor,
  onFetchBet,
  onFetchInfo,
  metrics,
  info
}: SolanaActionsProps) {
  return (
    <Card className="tech-card mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Solana Actions (Backup)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={onConnectWallet}>Connect Wallet</Button>
          <Button variant="success" onClick={onSubmitMemo}>Submit via Memo</Button>
          <Button variant="secondary" onClick={onSubmitAnchor}>Submit via Anchor</Button>
          <Button variant="outline" onClick={onFetchBet}>Fetch Bet Account</Button>
          <Button variant="outline" onClick={onFetchInfo}>Fetch RPC Info</Button>
        </div>

        {metrics && (
          <div className="mt-4 text-sm">
            <p>Signature: {metrics.signature}</p>
            {metrics.explorerUrl && (
              <p>
                Explorer: <a className="text-primary underline" href={metrics.explorerUrl} target="_blank">{metrics.explorerUrl}</a>
              </p>
            )}
            <p>Confirm: {metrics.confirmMs} ms</p>
            {metrics.feeLamports != null && <p>Fee: {metrics.feeLamports} lamports</p>}
            {metrics.slot != null && <p>Slot: {metrics.slot}</p>}
            {metrics.payloadBytes != null && <p>Payload bytes: {metrics.payloadBytes}</p>}
          </div>
        )}

        {info && (
          <div className="mt-4 text-sm">
            {info.balanceSol && <p>Balance: {info.balanceSol} SOL</p>}
            {info.slot && <p>Slot: {info.slot}</p>}
            {info.blockhash && <p>Blockhash: {info.blockhash}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}