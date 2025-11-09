'use client';

import { useSimpleTranslation } from '@/lib/i18n-simple';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Mock data for demonstration
const mockLeaderboardData = [
  {
    rank: 1,
    user: {
      name: 'Arii_Defi',
      avatar: null,
    },
    dollarScore: 35993500,
    refScore: 1701609,
    ptsScore: 6635491,
    multiplier: 2,
    total: 88661200,
  },
  {
    rank: 2,
    user: {
      name: 'CryptoWhale',
      avatar: null,
    },
    dollarScore: 28500000,
    refScore: 1200000,
    ptsScore: 5200000,
    multiplier: 1.8,
    total: 72400000,
  },
  {
    rank: 3,
    user: {
      name: 'PredictionKing',
      avatar: null,
    },
    dollarScore: 22000000,
    refScore: 950000,
    ptsScore: 4100000,
    multiplier: 1.5,
    total: 58200000,
  },
];

export function LeaderboardTable() {
  const { t } = useSimpleTranslation();

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toLocaleString();
  };

  return (
    <div className="tech-card overflow-hidden">
      {/* Table Header */}
      <div className="bg-muted px-6 py-4">
        <div className="grid grid-cols-8 gap-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <div>{t('leaderboard.rank')}</div>
          <div className="col-span-2">{t('leaderboard.user')}</div>
          <div className="text-right">$ SCORE</div>
          <div className="text-right">REF SCORE</div>
          <div className="text-right">PTS SCORE</div>
          <div className="text-right">MULTIPLIER</div>
          <div className="text-right">TOTAL</div>
        </div>
      </div>

      {/* Table Body */}
      <div className="space-y-2">
        {mockLeaderboardData.map((item) => (
          <div
            key={item.rank}
            className="px-6 py-4 hover:bg-accent transition-colors"
          >
            <div className="grid grid-cols-8 gap-4 items-center">
              {/* Rank */}
              <div className="flex items-center">
                <span
                  className={`text-2xl font-bold ${
                    item.rank === 1
                      ? 'text-yellow-500'
                      : item.rank === 2
                      ? 'text-gray-400'
                      : item.rank === 3
                      ? 'text-orange-600'
                      : 'text-gray-600'
                  }`}
                >
                  {item.rank}
                </span>
              </div>

              {/* User */}
              <div className="col-span-2 flex items-center space-x-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary text-white">
                    {item.user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-foreground">
                    {item.user.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    @{item.user.name.toLowerCase()}
                  </div>
                </div>
              </div>

              {/* Dollar Score */}
              <div className="text-right">
                <div className="font-semibold text-foreground">
                  {formatNumber(item.dollarScore)}
                </div>
              </div>

              {/* Ref Score */}
              <div className="text-right">
                <div className="font-semibold text-foreground">
                  {formatNumber(item.refScore)}
                </div>
              </div>

              {/* PTS Score */}
              <div className="text-right">
                <div className="font-semibold text-foreground">
                  {formatNumber(item.ptsScore)}
                </div>
              </div>

              {/* Multiplier */}
              <div className="text-right">
                <div className="font-semibold text-primary">
                  {item.multiplier}x
                </div>
              </div>

              {/* Total */}
              <div className="text-right">
                <div className="font-bold text-lg text-foreground">
                  {item.total.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground uppercase">
                  SC Score
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}