import { SportsBettingClient } from '@/components/sports/SportsBettingClient';

interface PageProps {
  params: { id: string };
}

export default function FootballFixturePage({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-background">
      <SportsBettingClient fixtureId={params.id} />
    </div>
  );
}