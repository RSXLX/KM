'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BackendMarketItem } from '@/types/backend';

export function BackendMarketCard({ item }: { item: BackendMarketItem }) {
  const ts = item.start_time ? new Date(item.start_time) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {item.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <div className="flex gap-2">
          <span className="px-2 py-1 rounded bg-secondary">{item.league}</span>
          <span>Status: {item.status}</span>
          {ts && <span>Start: {ts.toLocaleString()}</span>}
        </div>
      </CardContent>
    </Card>
  );
}