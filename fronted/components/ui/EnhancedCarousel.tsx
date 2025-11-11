'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { CarouselItem, CarouselConfig } from '@/types/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type EnhancedCarouselProps = {
  items: CarouselItem[];
  config?: CarouselConfig;
  className?: string;
};

const defaultConfig: Required<CarouselConfig> = {
  scale: 1.5,
  paddingPx: 24,
  radiusPx: 12,
  shadow: '0 8px 24px rgba(0,0,0,0.12)',
  gapPx: 16,
  autoplayMs: 4000,
  preloadAdjacent: true,
  maxVisible: 3,
};

export function EnhancedCarousel({ items, config, className }: EnhancedCarouselProps) {
  const cfg = { ...defaultConfig, ...(config ?? {}) };
  const enabledItems = useMemo(() => items.filter(i => i.enabled), [items]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const next = () => setIndex((i) => (i + 1) % Math.max(enabledItems.length, 1));
  const prev = () => setIndex((i) => (i - 1 + Math.max(enabledItems.length, 1)) % Math.max(enabledItems.length, 1));

  useEffect(() => {
    if (!cfg.autoplayMs || enabledItems.length <= 1) return;
    const id = window.setInterval(next, cfg.autoplayMs);
    timerRef.current = id;
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.autoplayMs, enabledItems.length]);

  // 预加载相邻图片
  useEffect(() => {
    if (!cfg.preloadAdjacent || enabledItems.length === 0) return;
    const targets: number[] = [];
    // 前一张
    targets.push((index - 1 + enabledItems.length) % enabledItems.length);
    // 下一组（可见数量 + 1）
    for (let k = 0; k < Math.max(1, 1 + 0); k++) {
      targets.push((index + Math.max(1, k + 1)) % enabledItems.length);
    }
    targets.forEach((i) => {
      const url = enabledItems[i]?.imageUrl;
      if (url) { const img = new window.Image(); img.src = url; }
    });
  }, [index, enabledItems, cfg.preloadAdjacent]);

  // 基础尺寸计算：按容器的宽度换算卡片尺寸
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 响应式决定并列显示数量：1/2/3，受 maxVisible 限制
  const visibleCount = useMemo(() => {
    if (containerWidth >= 1200) return Math.min(cfg.maxVisible, 3);
    if (containerWidth >= 800) return Math.min(cfg.maxVisible, 2);
    return 1;
  }, [containerWidth, cfg.maxVisible]);

  const computeCardWidth = () => {
    const totalGap = cfg.gapPx * Math.max(visibleCount - 1, 0);
    const available = Math.max(240, containerWidth - totalGap);
    const raw = (available / visibleCount) * cfg.scale; // 放大系数
    return Math.round(Math.min(Math.max(raw, 220), 720));
  };
  const cardWidth = computeCardWidth();

  return (
    <div ref={containerRef} className={className || ''}>
      <div className="flex items-center justify-between mb-2">
        <Button variant="outline" size="sm" onClick={prev}>Prev</Button>
        <span className="text-xs text-muted-foreground">{enabledItems.length ? `${index + 1} / ${enabledItems.length}` : '0 / 0'}</span>
        <Button variant="outline" size="sm" onClick={next}>Next</Button>
      </div>

      <div className="relative overflow-hidden">
        <div className="flex items-stretch" style={{ gap: cfg.gapPx }}>
          {enabledItems.length > 0 && Array.from({ length: visibleCount }).map((_, offset) => {
            const idx = (index + offset) % enabledItems.length;
            const item = enabledItems[idx];
            return (
              <motion.div
                key={item?.id || `empty-${offset}`}
                className="flex-shrink-0"
                style={{ width: cardWidth }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link href={item.href} className="block" prefetch>
                  <Card className="cursor-pointer select-none" style={{ borderRadius: cfg.radiusPx, boxShadow: cfg.shadow }}>
                    <CardContent className="p-6" style={{ padding: cfg.paddingPx }}>
                      <div className="w-full aspect-[16/9] relative overflow-hidden rounded-md">
                        <NextImage src={item.imageUrl} alt={item.title} fill sizes="(max-width: 640px) 100vw, 50vw" priority={false} />
                      </div>
                      <div className="mt-3">
                        <h3 className="text-base font-semibold leading-tight truncate" title={item.title}>{item.title}</h3>
                        {item.subtitle && (
                          <p className="text-sm text-muted-foreground mt-1 truncate" title={item.subtitle}>{item.subtitle}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default EnhancedCarousel;