'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { CarouselItem, CarouselCreatePayload, CarouselUpdatePayload } from '@/types/carousel';
import { apiClient } from '@/lib/apiClient';

export default function CarouselAdminPage() {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
      const raw = await apiClient.get(`${base}/api/v1/admin/carousel`, { timeoutMs: 8000 });
      // 兼容后端 ApiResponse { success, data } 包装
      const payload = raw?.data ?? raw;
      const list: any[] = Array.isArray(payload?.items) ? payload.items : Array.isArray(raw?.items) ? raw.items : [];
      // 后端字段为 image_url，映射为前端的 imageUrl
      const mapped: CarouselItem[] = list.map((it) => ({
        id: String(it.id || ''),
        title: String(it.title || ''),
        subtitle: it.subtitle || undefined,
        imageUrl: String(it.image_url || it.imageUrl || ''),
        href: String(it.href || ''),
        order: Number(it.order || 1),
        enabled: Boolean(it.enabled ?? true),
        createdAt: it.created_at || it.createdAt || undefined,
        updatedAt: it.updated_at || it.updatedAt || undefined,
      }));
      setItems(mapped);
    } catch (e: any) {
      setError(e?.message || 'fetch_failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const onCreate = async (payload: CarouselCreatePayload) => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    // 映射为后端字段 image_url
    const body = {
      id: payload.id,
      title: payload.title,
      subtitle: payload.subtitle,
      image_url: payload.imageUrl,
      href: payload.href,
      order: payload.order,
      enabled: payload.enabled,
    };
    const json = await apiClient.post(`${base}/api/v1/admin/carousel`, body, { timeoutMs: 8000 });
    // 后端返回 ApiResponse，成功状态为 success
    if (json?.success !== false) fetchItems();
  };

  const onUpdate = async (payload: CarouselUpdatePayload) => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    // 映射为后端字段 image_url
    const body: any = { id: payload.id };
    if (payload.title != null) body.title = payload.title;
    if (payload.subtitle != null) body.subtitle = payload.subtitle;
    if (payload.imageUrl != null) body.image_url = payload.imageUrl;
    if (payload.href != null) body.href = payload.href;
    if (payload.order != null) body.order = payload.order;
    if (payload.enabled != null) body.enabled = payload.enabled;
    const json = await apiClient.put(`${base}/api/v1/admin/carousel/${payload.id}`, body, { timeoutMs: 8000 });
    if (json?.success !== false) fetchItems();
  };

  const onDelete = async (id: string) => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const json = await apiClient.delete(`${base}/api/v1/admin/carousel/${id}`, { timeoutMs: 8000 });
    if (json?.success !== false) fetchItems();
  };

  const [draft, setDraft] = useState<CarouselCreatePayload>({ title: '', subtitle: '', imageUrl: '', href: '', order: 1, enabled: true });
  const [wallpapers, setWallpapers] = useState<string[]>([]);
  useEffect(() => { (async () => { try { const json = await apiClient.get('/api/wallpaper/list'); setWallpapers(json.files || []); } catch {} })(); }, []);

  const [uploading, setUploading] = useState<boolean>(false);
  const onUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setUploading(true);
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/wallpaper/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (json?.ok && json?.url) {
        setDraft(d => ({ ...d, imageUrl: json.url }));
      }
    } catch (e) {
      console.error('upload failed:', e);
    } finally {
      setUploading(false);
    }
  };

  const sorted = useMemo(() => [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [items]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Carousel 管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">标题</label>
              <Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="例如：NBA Finals Highlights" />
            </div>
            <div>
              <label className="text-sm">副标题</label>
              <Input value={draft.subtitle} onChange={e => setDraft(d => ({ ...d, subtitle: e.target.value }))} placeholder="例如：Lakers vs Celtics" />
            </div>
            <div>
              <label className="text-sm">图片地址</label>
              <Input value={draft.imageUrl} onChange={e => setDraft(d => ({ ...d, imageUrl: e.target.value }))} placeholder="/api/wallpaper/wallhaven-4l33el_1920x1080.png" />
              <div className="mt-2 flex items-center gap-2 overflow-x-auto">
                {wallpapers.map(name => (
                  <button key={name} className="text-xs underline" onClick={() => setDraft(d => ({ ...d, imageUrl: `/api/wallpaper/${name}` }))}>{name}</button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input type="file" accept="image/*" onChange={e => onUpload((e.target as HTMLInputElement).files?.[0] || null)} />
                {uploading && <span className="text-xs text-muted-foreground">上传中…</span>}
              </div>
            </div>
            <div>
              <label className="text-sm">链接地址</label>
              <Input value={draft.href} onChange={e => setDraft(d => ({ ...d, href: e.target.value }))} placeholder="/sports-betting?league=NBA" />
            </div>
            <div>
              <label className="text-sm">顺序</label>
              <Input type="number" value={draft.order} onChange={e => setDraft(d => ({ ...d, order: parseInt(e.target.value || '1', 10) }))} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="enabled" checked={draft.enabled} onCheckedChange={(v) => setDraft(d => ({ ...d, enabled: !!v }))} />
              <Label htmlFor="enabled" className="text-sm">启用</Label>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => onCreate(draft)}>新增卡片</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已配置的卡片（{sorted.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sorted.map((it) => (
              <div key={it.id} className="border rounded-md p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{it.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{it.subtitle}</div>
                  <div className="text-xs text-muted-foreground">order: {it.order} · {it.enabled ? 'enabled' : 'disabled'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onUpdate({ id: it.id, enabled: !it.enabled })}>{it.enabled ? '禁用' : '启用'}</Button>
                  <Button variant="outline" size="sm" onClick={() => onUpdate({ id: it.id, order: it.order + 1 })}>后移</Button>
                  <Button variant="outline" size="sm" onClick={() => onUpdate({ id: it.id, order: Math.max(1, it.order - 1) })}>前移</Button>
                  <Button variant="destructive" size="sm" onClick={() => onDelete(it.id)}>删除</Button>
                </div>
              </div>
            ))}
            {loading ? (
              <div className="text-xs text-muted-foreground">加载中…</div>
            ) : error ? (
              <div className="text-xs text-red-500">获取失败：{error}</div>
            ) : sorted.length === 0 ? (
              <div className="text-xs text-muted-foreground">暂无配置项</div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}