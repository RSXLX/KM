"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface ConfirmBetModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  fixtureId?: string;
  teamLabel: string; // 'Home' | 'Away'
  teamName: string;
  teamCode: string;
  amount: number;
  multiplier: number;
  oddsSelected: number; // 当前选择队伍的赔率
  payout: number;
}

export function ConfirmBetModal({
  open,
  onClose,
  onConfirm,
  fixtureId,
  teamLabel,
  teamName,
  teamCode,
  amount,
  multiplier,
  oddsSelected,
  payout,
}: ConfirmBetModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>确认下注</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">比赛 ID</span>
            <span className="font-medium">{fixtureId ?? '-'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">队伍</span>
            <span className="font-medium">{teamLabel} · {teamName} ({teamCode})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">金额</span>
            <span className="font-medium">{amount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">赔率</span>
            <span className="font-medium">{oddsSelected.toFixed(2)}x</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">倍数</span>
            <span className="font-medium">{multiplier.toFixed(2)}x</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">预计赔付</span>
            <span className="font-bold text-primary">{payout.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={async () => { await onConfirm(); onClose(); }}>确认下注</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}