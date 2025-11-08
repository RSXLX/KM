'use client'

import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LiveMatch } from '@/components/sports/LiveMatchCard';
import { InPlaySidebar } from '@/components/sports/InPlaySidebar';

interface MatchCarouselProps {
  items: LiveMatch[];
  title?: string;
}

export const MatchCarousel: React.FC<MatchCarouselProps> = ({ items, title = 'Live 热门比赛' }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LiveMatch | null>(null);

  // 仅显示 live 的内容
  const liveItems = useMemo(() => (items || []).filter(m => m?.status?.isLive === true), [items]);

  // 分类（基于 sport）
  const categories = useMemo(() => Array.from(new Set(liveItems.map(m => String(m.sport)))), [liveItems]);

  // 将 liveItems 按分类分组
  const grouped = useMemo(() => {
    const map: Record<string, LiveMatch[]> = {};
    categories.forEach(cat => { map[cat] = []; });
    liveItems.forEach(m => {
      const cat = String(m.sport);
      (map[cat] ||= []).push(m);
    });
    return map;
  }, [liveItems, categories]);

  const scrollBy = (delta: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const scrollToCategory = (cat: string) => {
    const el = anchorsRef.current[cat];
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    scroller.scrollTo({ left: el.offsetLeft - 12, behavior: 'smooth' });
  };

  const onOpen = (match: LiveMatch) => {
    setSelected(match);
    setOpen(true);
  };

  const onClose = () => setOpen(false);

return (
  <div className="w-full max-w-screen-2xl mx-auto overflow-hidden">

    {/* 响应式滚动区域：宽度跟随容器，防止超出 */}
    <div className="w-full max-w-full overflow-hidden">
      <div
        ref={scrollerRef}
        className="flex gap-2 w-full max-w-full overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory pb-2 box-border"
      >
        {categories.map((cat) => (
          <React.Fragment key={`group-${cat}`}>
            <Card
              className="snap-start rounded-none border-dashed flex-shrink-0 w-[20vw] sm:w-[16vw] md:w-[12vw] lg:w-[8vw] xl:w-[6vw] min-w-[80px] max-w-[140px] h-[clamp(80px,12vw,120px)]"
              role="button"
              onClick={() => scrollToCategory(cat)}
            >
              <CardContent className="p-4 flex items-center justify-center">
                <span className="text-xs sm:text-sm font-semibold">{cat}</span>
              </CardContent>
            </Card>

            {(grouped[cat] || []).map((m, idx) => (
              <div
                key={m.id}
                ref={idx === 0 ? (el) => { anchorsRef.current[cat] = el; } : undefined}
                className="snap-start flex-shrink-0 w-[88vw] sm:w-[72vw] md:w-[54vw] lg:w-[36vw] xl:w-[28vw] 2xl:w-[24vw] min-w-[220px] max-w-[560px]"
              >
                <Card
                  className="h-auto min-h-[clamp(60px,10vw,96px)] rounded-none cursor-pointer select-none transition-transform duration-300 ease-out hover:scale-[1.02] active:scale-[0.995] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={() => onOpen(m)}
                >
                  <CardContent className="p-2">
                    <div className="text-[10px] md:text-[11px] text-muted-foreground mb-0.5 flex items-center justify-between leading-tight">
                      <span>{m.league ?? m.sport}</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] md:text-[11px] border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 rounded-none">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate text-xs md:text-sm leading-tight">{m.teams?.home?.name}</div>
                      <span className="text-muted-foreground text-[10px] md:text-xs">vs</span>
                      <div className="font-medium truncate text-xs md:text-sm leading-tight">{m.teams?.away?.name}</div>
                    </div>
                    <div className="mt-0.5 text-[10px] md:text-xs text-muted-foreground flex items-center justify-between leading-tight">
                      <span>{m?.status?.time ?? '进行中'}</span>
                      <span className="text-[10px] md:text-xs">{m?.status?.phase ?? ''}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>

    <InPlaySidebar open={open} onClose={onClose} match={selected ?? undefined} />
  </div>
);
};

export default MatchCarousel;