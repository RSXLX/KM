'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SportsBettingClient } from '@/components/sports/SportsBettingClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Users, TrendingUp } from 'lucide-react';
import { TeamDetailsSection } from './TeamDetailsSection';
import { MyBet } from './MyBet';
import type { LiveMatch } from './LiveMatchCard';

interface InPlaySidebarProps {
  open: boolean;
  onClose: () => void;
  match?: LiveMatch | null;
}

export function InPlaySidebar({ open, onClose, match }: InPlaySidebarProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 锁定页面滚动，抽屉内独立滚动
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // 关闭动画：在 close 时保留节点一段时间以播放动画
  const ANIMATION_MS = 300; // 持续时间与 ease 曲线匹配
  const [mounted, setMounted] = useState<boolean>(open);
  const [closing, setClosing] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, ANIMATION_MS);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  if (!mounted) return null;

  const panelTransition = 'transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]';
  const overlayTransition = 'transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]';

  const content = (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[110]">
      {/* 背景遮罩 */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${overlayTransition} ${closing ? 'opacity-0' : 'opacity-100'}`}
        onClick={onClose}
      />

      {/* 右侧面板 */}
      <div
        className={`absolute right-0 top-0 h-dvh w-full sm:w-[90vw] md:w-[85vw] lg:w-[75vw] max-w-[1280px] bg-card border-l border-border/50 shadow-2xl ${panelTransition} ${closing ? 'translate-x-full' : 'translate-x-0'}`}
      >
        {/* 顶部工具栏与标题（仿 bet.placeBet 信息组织） */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <p className="text-xs text-muted-foreground">bet.placeBet</p>
            <h2 className="text-lg font-semibold">{match?.teams.home.name} vs {match?.teams.away.name}</h2>
            <p className="text-xs text-muted-foreground">{match?.sport} · {match?.status.time}</p>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Close" onClick={onClose} className="p-2 rounded-md hover:bg-accent">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容滚动区域 */}
        <div className="h-[calc(100dvh-56px)] overflow-y-auto px-6 py-4 min-w-0">
          {/* 关键指标卡片 */}
          <Card className="tech-card mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Market Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Home Odds</p>
                  <p className="font-semibold text-green-500">{match?.liveOdds.home}</p>
                </div>
                {match?.liveOdds.draw != null && (
                  <div>
                    <p className="text-muted-foreground">Draw Odds</p>
                    <p className="font-semibold text-yellow-500">{match?.liveOdds.draw}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Away Odds</p>
                  <p className="font-semibold text-red-500">{match?.liveOdds.away}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-semibold">{match?.status.isLive ? 'LIVE' : 'Ended'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 体育博彩详情主体，随抽屉宽度扩展至 3/4 屏 */}
          <div className="w-full">
            <SportsBettingClient 
            fixtureId={match?.id} 
            isLiveSignal={match?.status?.isLive === true}
            onBetSuccess={() => setRefreshTrigger(prev => prev + 1)}
          />
          </div>

          <Separator className="my-4" />

          {/* 我的投注信息 */}
          <MyBet fixtureId={match?.id} className="mb-4" refreshTrigger={refreshTrigger} />

          <Separator className="my-4" />

          {/* 球队信息、球员信息和球队统计 */}
          <TeamDetailsSection match={match} />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}