import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { LeaderboardHeader } from '@/components/leaderboard/LeaderboardHeader';

export default function LeaderboardPage() {
  return (
    <ResponsiveLayout>
      <div className="p-6">
        <LeaderboardHeader />
        <LeaderboardTable />
      </div>
    </ResponsiveLayout>
  );
}