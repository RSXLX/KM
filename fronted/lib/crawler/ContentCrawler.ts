import axios from 'axios';
import { CrawledContent, MarketSuggestion } from '@/types';

interface DataSource {
  id: string;
  name: string;
  baseUrl: string;
  categories: string[];
  selectors: {
    title: string;
    description: string;
    image: string;
    link: string;
    date: string;
  };
  rateLimit: number; // requests per minute
}

export class ContentCrawler {
  private sources: DataSource[] = [
    {
      id: 'coindesk',
      name: 'CoinDesk',
      baseUrl: 'https://www.coindesk.com',
      categories: ['crypto'],
      selectors: {
        title: 'h3.heading',
        description: '.article-cardstyles__Excerpt',
        image: 'img',
        link: 'a',
        date: 'time'
      },
      rateLimit: 30
    },
    {
      id: 'reuters',
      name: 'Reuters',
      baseUrl: 'https://www.reuters.com',
      categories: ['politics', 'economy'],
      selectors: {
        title: 'h3[data-testid="Heading"]',
        description: 'p[data-testid="Body"]',
        image: 'img',
        link: 'a',
        date: 'time'
      },
      rateLimit: 20
    },
    {
      id: 'techcrunch',
      name: 'TechCrunch',
      baseUrl: 'https://techcrunch.com',
      categories: ['tech'],
      selectors: {
        title: 'h2.post-block__title',
        description: '.post-block__content',
        image: 'img',
        link: 'a',
        date: 'time'
      },
      rateLimit: 25
    }
  ];

  async crawlContentByCategory(category: string): Promise<CrawledContent[]> {
    const relevantSources = this.sources.filter(source => 
      source.categories.includes(category)
    );

    const results = await Promise.allSettled(
      relevantSources.map(source => this.crawlFromSource(source, category))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<CrawledContent[]> => 
        result.status === 'fulfilled'
      )
      .flatMap(result => result.value)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20); // Limit to top 20 results
  }

  private async crawlFromSource(source: DataSource, category: string): Promise<CrawledContent[]> {
    try {
      // Use a proxy service for CORS in production
      const targetUrl = this.buildCategoryUrl(source, category);
      
      // In a real implementation, you would use a backend service or proxy
      // For demo purposes, we'll return mock data
      return this.getMockContent(source, category);
      
    } catch (error) {
      console.error(`Failed to crawl from ${source.name}:`, error);
      return [];
    }
  }

  private buildCategoryUrl(source: DataSource, category: string): string {
    const categoryPaths: Record<string, Record<string, string>> = {
      coindesk: {
        crypto: '/markets/',
        tech: '/tech/'
      },
      reuters: {
        politics: '/world/us/',
        economy: '/business/finance/'
      },
      techcrunch: {
        tech: '/category/artificial-intelligence/',
        gaming: '/category/gaming/'
      }
    };

    const path = categoryPaths[source.id]?.[category] || '/';
    return `${source.baseUrl}${path}`;
  }

  private async parseContentFromHtml(html: string, source: DataSource): Promise<CrawledContent[]> {
    // This method is currently not used as we're using mock data
    // In a real implementation, this would parse HTML content with a library like cheerio
    console.warn('parseContentFromHtml is not implemented for static builds');
    return [];
  }

  private resolveImageUrl(imageUrl: string, baseUrl: string): string {
    if (!imageUrl) return '/images/placeholder.jpg';
    if (imageUrl.startsWith('http')) return imageUrl;
    if (imageUrl.startsWith('//')) return `https:${imageUrl}`;
    if (imageUrl.startsWith('/')) return `${baseUrl}${imageUrl}`;
    return `${baseUrl}/${imageUrl}`;
  }

  private resolveUrl(url: string, baseUrl: string): string {
    if (!url) return baseUrl;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${baseUrl}${url}`;
    return `${baseUrl}/${url}`;
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    
    // Try parsing ISO date
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) return isoDate;
    
    // Try parsing relative dates like "2 hours ago"
    const now = new Date();
    const relativePattern = /(\d+)\s+(hour|day|week)s?\s+ago/i;
    const match = dateStr.match(relativePattern);
    
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      switch (unit) {
        case 'hour':
          return new Date(now.getTime() - amount * 60 * 60 * 1000);
        case 'day':
          return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
        case 'week':
          return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
      }
    }
    
    return new Date();
  }

  private calculateRelevance(text: string, category: string): number {
    const keywords = this.getCategoryKeywords(category);
    const lowerText = text.toLowerCase();
    
    let score = 0;
    let totalKeywords = keywords.length;
    
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    });
    
    return totalKeywords > 0 ? score / totalKeywords : 0.5;
  }

  private getCategoryKeywords(category: string): string[] {
    const keywordMap: Record<string, string[]> = {
      crypto: ['bitcoin', 'ethereum', 'blockchain', 'cryptocurrency', 'defi', 'nft', 'mining', 'wallet', 'exchange'],
      sports: ['championship', 'tournament', 'playoff', 'season', 'match', 'game', 'team', 'player', 'score'],
      politics: ['election', 'government', 'president', 'congress', 'policy', 'vote', 'campaign', 'senate'],
      economy: ['market', 'stock', 'finance', 'recession', 'inflation', 'gdp', 'economy', 'trading', 'investment'],
      gaming: ['esports', 'tournament', 'gaming', 'video game', 'streamer', 'competition', 'player'],
      culture: ['entertainment', 'movie', 'music', 'celebrity', 'art', 'fashion', 'culture', 'festival'],
      tech: ['technology', 'ai', 'artificial intelligence', 'software', 'startup', 'innovation', 'science', 'research']
    };
    
    return keywordMap[category] || [];
  }

  // Mock content for demo purposes
  private getMockContent(source: DataSource, category: string): CrawledContent[] {
    const mockContent: Record<string, CrawledContent[]> = {
      crypto: [
        {
          title: 'Bitcoin Reaches New All-Time High as Institutional Adoption Grows',
          description: 'Major financial institutions continue to add Bitcoin to their portfolios, driving the price to unprecedented levels.',
          imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400',
          source: source.name,
          category,
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          url: `${source.baseUrl}/bitcoin-new-high`,
          confidence: 0.95
        },
        {
          title: 'Ethereum 2.0 Staking Surpasses 15 Million ETH Milestone',
          description: 'The Ethereum network sees unprecedented staking participation as users lock up ETH for rewards.',
          imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400',
          source: source.name,
          category,
          publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
          url: `${source.baseUrl}/ethereum-staking-milestone`,
          confidence: 0.87
        }
      ],
      sports: [
        {
          title: 'NBA Finals Predictions: Lakers vs Celtics Championship Showdown',
          description: 'Two historic franchises prepare for what could be the most watched NBA Finals in recent history.',
          imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
          source: source.name,
          category,
          publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          url: `${source.baseUrl}/nba-finals-preview`,
          confidence: 0.92
        }
      ],
      tech: [
        {
          title: 'AI Breakthrough: New Model Achieves Human-Level Performance in Complex Reasoning',
          description: 'Researchers unveil an AI system that can solve complex problems with reasoning capabilities rivaling human experts.',
          imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400',
          source: source.name,
          category,
          publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
          url: `${source.baseUrl}/ai-breakthrough-reasoning`,
          confidence: 0.88
        }
      ]
    };

    return mockContent[category] || [];
  }
}