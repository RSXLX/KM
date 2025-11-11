'use client';

import React, { useEffect, useState } from 'react';
import { EnhancedCarousel } from '@/components/ui/EnhancedCarousel';
import type { CarouselItem } from '@/types/carousel';
import { apiClient } from '@/lib/apiClient';

export default function TestCarouselPage() {
  const [items, setItems] = useState<CarouselItem[]>([]);
  useEffect(() => {
    (async () => {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
      const raw = await apiClient.get(`${base}/api/v1/admin/carousel`);
      const payload = raw?.data ?? raw;
      const list: any[] = Array.isArray(payload?.items) ? payload.items : Array.isArray(raw?.items) ? raw.items : [];
      const toAbs = (u: string) => {
        if (!u) return '';
        if (u.startsWith('http://') || u.startsWith('https://')) return u;
        if (u.startsWith('/')) return `${base}${u}`; // 后端返回相对路径时拼接基地址
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
    })();
  }, []);
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-3">Enhanced Carousel 预览</h1>
      <EnhancedCarousel items={items} />
    </div>
  );
}