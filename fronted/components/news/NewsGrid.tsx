'use client';

import { useState, useEffect } from 'react';
import { NewsCard } from './NewsCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Mock news data (in real app, this would come from API)
const mockNewsData = [
  {
    id: '1',
    title: 'Bitcoin Reaches New All-Time High Amid Institutional Adoption',
    summary: 'Bitcoin surges past $70,000 as major corporations continue to add the cryptocurrency to their treasury reserves, signaling growing institutional confidence.',
    imageUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&h=300&fit=crop',
    source: 'CoinDesk',
    publishedAt: new Date('2024-01-15T10:30:00Z'),
    category: 'crypto',
    url: 'https://example.com/bitcoin-ath'
  },
  {
    id: '2',
    title: 'NFL Playoffs Heat Up with Surprising Upsets',
    summary: 'Underdogs dominate the wild card round as several top-seeded teams face unexpected defeats, reshaping championship predictions.',
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&h=300&fit=crop',
    source: 'ESPN',
    publishedAt: new Date('2024-01-14T18:45:00Z'),
    category: 'sports',
    url: 'https://example.com/nfl-upsets'
  },
  {
    id: '3',
    title: 'Federal Reserve Signals Potential Rate Cuts This Year',
    summary: 'Fed Chair hints at possible interest rate reductions if inflation continues its downward trend, potentially boosting market sentiment.',
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop',
    source: 'Reuters',
    publishedAt: new Date('2024-01-14T14:20:00Z'),
    category: 'economy',
    url: 'https://example.com/fed-rates'
  },
  {
    id: '4',
    title: 'AI Breakthrough: New Model Achieves Human-Level Reasoning',
    summary: 'Researchers unveil advanced AI system that demonstrates unprecedented problem-solving capabilities across multiple domains.',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop',
    source: 'TechCrunch',
    publishedAt: new Date('2024-01-14T09:15:00Z'),
    category: 'tech',
    url: 'https://example.com/ai-breakthrough'
  },
  {
    id: '5',
    title: 'Global Climate Summit Reaches Historic Agreement',
    summary: 'World leaders commit to ambitious carbon reduction targets as climate action takes center stage in international diplomacy.',
    imageUrl: 'https://images.unsplash.com/photo-1569163139394-de44cb854552?w=400&h=300&fit=crop',
    source: 'BBC News',
    publishedAt: new Date('2024-01-13T16:30:00Z'),
    category: 'politics',
    url: 'https://example.com/climate-summit'
  },
  {
    id: '6',
    title: 'Gaming Industry Sees Record Revenue Growth',
    summary: 'Video game sales reach unprecedented levels as mobile gaming and esports continue their explosive growth trajectory.',
    imageUrl: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=300&fit=crop',
    source: 'GameIndustry.biz',
    publishedAt: new Date('2024-01-13T12:45:00Z'),
    category: 'gaming',
    url: 'https://example.com/gaming-revenue'
  }
];

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  source: string;
  publishedAt: Date;
  category: string;
  url: string;
}

export function NewsGrid() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchNews = async () => {
      setIsLoading(true);
      // In real app, this would be an actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNews(mockNewsData);
      setIsLoading(false);
    };

    fetchNews();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {news.map((item) => (
        <NewsCard key={item.id} news={item} />
      ))}
    </div>
  );
}