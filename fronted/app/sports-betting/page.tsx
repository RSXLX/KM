import { SportsBettingClient } from '@/components/sports/SportsBettingClient';

export default function SportsBettingPage({ searchParams }: { searchParams?: { fixtureId?: string; autoOpen?: string; inplay?: string } }) {
  const fixtureId = searchParams?.fixtureId ?? searchParams?.inplay;
  return (
    <div className="min-h-screen bg-background">
      <SportsBettingClient fixtureId={fixtureId} />
    </div>
  );
}