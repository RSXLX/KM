'use client';

import { useEffect, useState } from 'react';
import { useSimpleTranslation } from '@/lib/i18n-simple';
import { SportsClassifiedGrid } from '@/components/sports/SportsClassifiedGrid';
import MatchCarousel from '@/components/custom/MatchCarousel';
import type { LiveMatch } from '@/components/sports/LiveMatchCard';
import ImageCarousel, { ImageItem } from '@/components/custom/ImageCarousel';
// 移除首页 mock 图片与比赛数据，统一改为后端数据来源
// import { promoImageItems } from '@/lib/home/mockImageCarousel';
// import { mockLiveMatches } from '@/lib/sports/mockLiveMatches';
import { useInplayMarkets } from '@/hooks/useInplayMarkets';
import { apiFetch, OddsResponse } from '@/lib/api';

interface MainContentProps {
  topBarHeight?: number;
  sidebarWidth?: number;
}

export function MainContent({ topBarHeight = 64, sidebarWidth }: MainContentProps) {
  const { t } = useSimpleTranslation();
  const { data: inplayList, isLoading, error, refetch } = useInplayMarkets();
  const liveMatches: LiveMatch[] = (inplayList || []).map(item => {
    const [homeNameRaw, awayNameRaw] = String(item.title || 'Home vs Away').split(/\s+vs\s+/i);
    const homeName = (homeNameRaw || 'Home').trim();
    const awayName = (awayNameRaw || 'Away').trim();
    const liveOdds = item.moneyline ? { home: item.moneyline.home, away: item.moneyline.away, lastUpdated: item.timestamp } : undefined;
    return {
      id: String(item.market_id),
      sport: item.category || 'Sports',
      teams: { home: { name: homeName, score: item.score?.home }, away: { name: awayName, score: item.score?.away } },
      status: { isLive: item.status?.isLive ?? true, time: item.status?.time ?? 'Live', phase: item.status?.phase, minute: item.status?.minute, second: item.status?.second, period: item.status?.period },
      liveOdds,
      marketUrl: `/sports-betting?fixtureId=${item.market_id}`,
      league: item.category || 'Sports',
    } as LiveMatch;
  });

  return (
    <main 
      className="min-h-screen bg-background transition-all duration-300"
      style={{ 
        marginTop: `${topBarHeight}px`
      }}
    >
      <div className="p-6 max-w-screen-3xl mx-auto">
        {/* Carousels */}
        <section className="space-y-6 mb-8 ">
          {/* Loading / Error 状态 */}
          {isLoading && (
            <div className="text-sm text-muted-foreground">Loading active markets...</div>
          )}
          {error && !isLoading && (
            <div className="text-sm text-destructive flex items-center gap-2">
              Failed to load: {error}
              <button onClick={() => refetch()} className="px-2 py-1 rounded bg-muted hover:bg-accent">Retry</button>
            </div>
          )}
          {/* Match Carousel - 只显示 Live 内容，点击打开抽屉 */}
          {!isLoading && !error && (
            <div className="w-full overflow-hidden max-w-screen-3xl">
              {liveMatches.length > 0 ? (
                <MatchCarousel items={liveMatches} />
              ) : (
                <div className="text-sm text-muted-foreground">No active markets</div>
              )}
            </div>
          )}
        </section>
        {/* Sports Only Section */}
        <section>
  
          <SportsClassifiedGrid />
        </section>
      </div>
    </main>
  );
}