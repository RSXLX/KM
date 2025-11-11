'use client';

import React, { useEffect, useState } from 'react';
import { useSimpleTranslation } from '@/lib/i18n-simple';
import { EventsQuickBar } from '@/components/sports/EventsQuickBar';
import { EnhancedCarousel } from '@/components/ui/EnhancedCarousel';
import { SportsClassifiedGrid } from '@/components/sports/SportsClassifiedGrid';
import type { CarouselItem } from '@/types/carousel';
import { apiClient } from '@/lib/apiClient';

interface MainContentProps {
  topBarHeight?: number;
  sidebarWidth?: number;
}

export function MainContent({ topBarHeight = 64, sidebarWidth }: MainContentProps) {
  const { t } = useSimpleTranslation();
  const [items, setItems] = useState<CarouselItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
        const raw = await apiClient.get(`${base}/api/v1/admin/carousel`);
        const payload = raw?.data ?? raw;
        const list: any[] = Array.isArray(payload?.items) ? payload.items : Array.isArray(raw?.items) ? raw.items : [];
        const toAbs = (u: string) => {
          if (!u) return '';
          if (u.startsWith('http://') || u.startsWith('https://')) return u;
          if (u.startsWith('/')) return `${base}${u}`;
          return u;
        };
        const mapped = list.map((it) => ({
          id: String(it.id || ''),
          title: String(it.title || ''),
          subtitle: it.subtitle || undefined,
          imageUrl: toAbs(String(it.image_url || it.imageUrl || '')),
          href: String(it.href || ''),
          order: Number(it.order || 1),
          enabled: Boolean(it.enabled ?? true),
          createdAt: it.created_at || it.createdAt || undefined,
          updatedAt: it.updated_at || it.updatedAt || undefined,
        }));
        setItems(mapped);
      } catch (e: any) {
        console.warn('[MainContent] load carousel failed:', e?.message || e);
      }
    };
    load();
  }, []);

  return (
    <main className="min-h-screen bg-background transition-all duration-300">
      <div className="p-6 space-y-6">
        {/* 顶部：赛事快捷栏 */}
        <section>
          <EventsQuickBar />
        </section>

        {/* 第二部分：轮播（后端数据） */}
        <section>
          <EnhancedCarousel items={items} />
        </section>

        {/* 保持现有体育分类网格 */}
        <section>
          <SportsClassifiedGrid />
        </section>
      </div>
    </main>
  );
}