import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { MarketsGrid } from '@/components/markets/MarketsGrid';
import { MarketsHeader } from '@/components/markets/MarketsHeader';

export default function MarketsPage() {
  return (
    <ResponsiveLayout>
      <div className="p-6">
        <MarketsHeader />
        <MarketsGrid />
      </div>
    </ResponsiveLayout>
  );
}