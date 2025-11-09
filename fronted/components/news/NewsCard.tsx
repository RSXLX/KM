'use client';

import Image from 'next/image';
import { Clock, ExternalLink } from 'lucide-react';
import { NewsItem } from './NewsGrid';
import { formatDistanceToNow } from 'date-fns';

interface NewsCardProps {
  news: NewsItem;
}

export function NewsCard({ news }: NewsCardProps) {
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      crypto: 'bg-orange-500',
      sports: 'bg-green-500',
      politics: 'bg-red-500',
      economy: 'bg-blue-500',
      gaming: 'bg-purple-500',
      culture: 'bg-pink-500',
      tech: 'bg-indigo-500'
    };
    return colors[category] || 'bg-gray-500';
  };

  const handleCardClick = () => {
    window.open(news.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      className="tech-card group cursor-pointer overflow-hidden transition-all duration-300 hover:scale-105"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={news.imageUrl}
          alt={news.title}
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-110"
        />
        
        {/* Category Badge */}
        <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium text-white ${getCategoryColor(news.category)}`}>
          {news.category.toUpperCase()}
        </div>

        {/* External Link Icon */}
        <div className="absolute top-3 right-3 w-8 h-8 bg-black bg-opacity-60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-4 h-4 text-white" />
        </div>
      </div>

      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-foreground mb-3 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {news.title}
        </h3>

        {/* Summary */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {news.summary}
        </p>

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-foreground">{news.source}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{formatDistanceToNow(news.publishedAt, { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}