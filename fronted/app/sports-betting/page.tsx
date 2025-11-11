import { SportsBettingClient } from '@/components/sports/SportsBettingClient';
import { EventsQuickBar } from '@/components/sports/EventsQuickBar';

export default function SportsBettingPage({ searchParams }: { searchParams?: { fixtureId?: string; autoOpen?: string; inplay?: string } }) {
  const fixtureId = searchParams?.fixtureId ?? searchParams?.inplay;
  return (
    <div className="min-h-screen bg-background relative z-[200]">
      {/* 赛事快捷栏 */}
      <EventsQuickBar />
      <SportsBettingClient fixtureId={fixtureId} />
    </div>
  );
}