"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AccountBetRecordsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/account/positions');
  }, [router]);

  return (
    <ResponsiveLayout>
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">页面已迁移到 My Contract</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              我们已将“我的投注”整合进“持仓”页面并统一命名为 My Contract。
            </p>
            <Button onClick={() => router.replace('/account/positions')}>前往 My Contract</Button>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
}