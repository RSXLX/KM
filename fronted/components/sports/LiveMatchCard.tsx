'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type Team = {
  name: string;
  score?: number;
  code?: string;
};

export type MatchStatus = {
  time?: string;
  isLive?: boolean;
  phase?: string;
  period?: number;
  minute?: number;
  second?: number;
  overtime?: boolean;
  halftime?: boolean;
  finished?: boolean;
  suspended?: boolean;
  postponed?: boolean;
};

export type LiveOdds = {
  home?: number;
  draw?: number;
  away?: number;
  lastUpdated?: number;
  trend?: 'up' | 'down' | 'stable';
};

export type LiveMatch = {
  id: string;
  sport: string;
  teams: { home: Team; away: Team };
  status: MatchStatus;
  liveOdds?: LiveOdds;
  marketUrl: string;
  startTime?: string;
  venue?: string;
  league?: string;
  round?: string;
  attendance?: number;
  temperature?: number;
  weather?: string;
};

export function LiveMatchCard({ match, onOpen }: { match: LiveMatch; onOpen?: (m: LiveMatch) => void }) {
  const { sport, teams, status, liveOdds, marketUrl } = match;

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen?.(match);
  };

  // 获取状态显示文本
  const getStatusDisplay = () => {
    if (status.finished) return 'FT';
    if (status.suspended) return 'SUSP';
    if (status.postponed) return 'POSTP';
    if (status.halftime) return 'HT';
    if (status.overtime) return 'OT';
    return status.time || 'Scheduled';
  };

  // 获取状态颜色
  const getStatusColor = () => {
    if (status.isLive) return 'text-emerald-500';
    if (status.finished) return 'text-blue-500';
    if (status.suspended || status.postponed) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const CardInner = (
    <Card className="min-w-0 group cursor-pointer select-none transition-transform duration-200 ease-in-out hover:scale-[1.02] active:scale-[0.99] hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{sport}</span>
          <div className="flex items-center gap-2">
            {status?.isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/30 text-xs text-emerald-500 bg-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
            <span className={`text-xs ${getStatusColor()}`}>
              {getStatusDisplay()}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">{teams.home.name}</span>
          <span className="font-bold text-lg">{teams.home.score ?? '-'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">{teams.away.name}</span>
          <span className="font-bold text-lg">{teams.away.score ?? '-'}</span>
        </div>
        {status?.phase && (
          <div className="text-xs text-muted-foreground text-center">
            {status.phase}
          </div>
        )}
        {liveOdds && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-muted px-2 py-1 text-center">
              <div className="text-xs text-muted-foreground">H</div>
              <div className="font-medium">{liveOdds.home?.toFixed(2) ?? '-'}</div>
            </div>
            {'draw' in liveOdds && liveOdds.draw && (
              <div className="rounded bg-muted px-2 py-1 text-center">
                <div className="text-xs text-muted-foreground">D</div>
                <div className="font-medium">{liveOdds.draw.toFixed(2)}</div>
              </div>
            )}
            <div className="rounded bg-muted px-2 py-1 text-center">
              <div className="text-xs text-muted-foreground">A</div>
              <div className="font-medium">{liveOdds.away?.toFixed(2) ?? '-'}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (onOpen) {
    return (
      <div onClick={handleOpen} className="min-w-0">
        {CardInner}
      </div>
    );
  }

  return (
    <Link href={marketUrl} className="block">
      {CardInner}
    </Link>
  );
}