'use client';

import { useSimpleTranslation } from '@/lib/i18n-simple';

interface TopicCardProps {
  topic: {
    id: string;
    label: string;
    icon: string;
    color: string;
  };
  onClick: () => void;
}

export function TopicCard({ topic, onClick }: TopicCardProps) {
  const { t } = useSimpleTranslation();

  // Mock market count for each topic
  const getMarketCount = (topicId: string) => {
    const counts: Record<string, number> = {
      crypto: 24,
      sports: 18,
      politics: 12,
      economy: 15,
      gaming: 21,
      culture: 9,
      tech: 16
    };
    return counts[topicId] || 10;
  };

  return (
    <div 
      className="tech-card group cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-2"
      onClick={onClick}
    >
      <div className="p-6 text-center">
        {/* Icon */}
        <div 
          className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300"
          style={{ backgroundColor: topic.color }}
        >
          {topic.icon}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
          {t(`topics.${topic.id}`)}
        </h3>

        {/* Market Count */}
        <p className="text-sm text-muted-foreground mb-4">
          {getMarketCount(topic.id)} Active Markets
        </p>

        {/* Description based on topic */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {getTopicDescription(topic.id)}
        </p>

        {/* Hover indicator */}
        <div className="mt-4 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Click to explore →
        </div>
      </div>
    </div>
  );
}

function getTopicDescription(topicId: string): string {
  const descriptions: Record<string, string> = {
    crypto: 'Bitcoin, Ethereum, DeFi protocols, and cryptocurrency market predictions',
    sports: 'NFL, NBA, FIFA, Olympics, and major sporting event outcomes',
    politics: 'Elections, policy decisions, government changes, and political events',
    economy: 'Stock markets, inflation rates, GDP growth, and economic indicators',
    gaming: 'Esports tournaments, game releases, player transfers, and industry trends',
    culture: 'Movies, music, celebrities, awards shows, and cultural phenomena',
    tech: 'Tech IPOs, product launches, AI breakthroughs, and innovation trends'
  };
  return descriptions[topicId] || 'Explore prediction markets in this category';
}