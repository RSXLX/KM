'use client';

import { useRouter } from 'next/navigation';
import { sidebarConfig } from '@/lib/config';
import { TopicCard } from './TopicCard';
import { useMarkets } from '@/hooks/useMarkets';
import { BackendMarketCard } from './BackendMarketCard';

export function MarketsGrid() {
  const router = useRouter();
  const { markets, isLoading } = useMarkets({ page: 1, pageSize: 12 });

  const handleTopicClick = (topicId: string) => {
    // 点击跳回主页
    router.push('/');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {sidebarConfig.topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} onClick={() => handleTopicClick(topic.id)} />
      ))}
      {/* 后端市场列表 */}
      {isLoading ? (
        <div className="col-span-full text-muted-foreground">Loading markets...</div>
      ) : (
        markets.map((m) => <BackendMarketCard key={m.id} item={m} />)
      )}
    </div>
  );
}