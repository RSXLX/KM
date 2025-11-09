import { CrawledContent, MarketSuggestion } from '@/types';

interface MarketTemplate {
  pattern: RegExp;
  question: string;
  timeframe: string; // e.g., '30d', '90d', '1y'
  reliability: number; // 0-1 confidence in this template
  category: string;
}

export class ContentMapper {
  private templates: MarketTemplate[] = [
    // Crypto templates
    {
      pattern: /bitcoin.*(\$[\d,]+)/i,
      question: 'Will Bitcoin reach {price} by {date}?',
      timeframe: '90d',
      reliability: 0.8,
      category: 'crypto'
    },
    {
      pattern: /ethereum.*upgrade|merge/i,
      question: 'Will the Ethereum upgrade be successful by {date}?',
      timeframe: '180d',
      reliability: 0.7,
      category: 'crypto'
    },
    {
      pattern: /crypto.*etf.*approv/i,
      question: 'Will a Bitcoin ETF be approved by {date}?',
      timeframe: '365d',
      reliability: 0.75,
      category: 'crypto'
    },

    // Sports templates
    {
      pattern: /([\w\s]+)\s+vs\s+([\w\s]+).*championship|final/i,
      question: 'Will {team1} beat {team2} in the championship?',
      timeframe: '30d',
      reliability: 0.9,
      category: 'sports'
    },
    {
      pattern: /([\w\s]+).*win.*championship|title/i,
      question: 'Will {team} win the championship this season?',
      timeframe: '180d',
      reliability: 0.85,
      category: 'sports'
    },

    // Politics templates
    {
      pattern: /election.*(\d{4})/i,
      question: 'Will the incumbent win the {year} election?',
      timeframe: '365d',
      reliability: 0.8,
      category: 'politics'
    },
    {
      pattern: /([\w\s]+).*resign|impeach/i,
      question: 'Will {person} resign from office by {date}?',
      timeframe: '180d',
      reliability: 0.7,
      category: 'politics'
    },

    // Economy templates
    {
      pattern: /fed.*interest.*rate.*cut|raise/i,
      question: 'Will the Fed cut interest rates by {date}?',
      timeframe: '90d',
      reliability: 0.85,
      category: 'economy'
    },
    {
      pattern: /recession.*(\d{4})/i,
      question: 'Will there be a recession in {year}?',
      timeframe: '365d',
      reliability: 0.75,
      category: 'economy'
    },
    {
      pattern: /stock.*market.*crash/i,
      question: 'Will the stock market crash by {date}?',
      timeframe: '180d',
      reliability: 0.7,
      category: 'economy'
    },

    // Tech templates
    {
      pattern: /ai.*replace.*(\d+).*job/i,
      question: 'Will AI replace {percentage} of jobs by {date}?',
      timeframe: '1y',
      reliability: 0.6,
      category: 'tech'
    },
    {
      pattern: /self.*driving.*car.*(\d{4})/i,
      question: 'Will self-driving cars be mainstream by {year}?',
      timeframe: '2y',
      reliability: 0.65,
      category: 'tech'
    },

    // Gaming templates
    {
      pattern: /([\w\s]+).*tournament.*prize/i,
      question: 'Will {game} tournament have record prize pool in {year}?',
      timeframe: '365d',
      reliability: 0.8,
      category: 'gaming'
    }
  ];

  async mapContentToMarkets(content: CrawledContent[]): Promise<MarketSuggestion[]> {
    const suggestions: MarketSuggestion[] = [];

    for (const item of content) {
      const marketSuggestion = await this.generateMarketFromContent(item);
      if (marketSuggestion && marketSuggestion.confidence > 0.6) {
        suggestions.push(marketSuggestion);
      }
    }

    // Sort by confidence and return top suggestions
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  private async generateMarketFromContent(content: CrawledContent): Promise<MarketSuggestion | null> {
    const categoryTemplates = this.templates.filter(t => t.category === content.category);
    const allTemplates = [...categoryTemplates, ...this.templates.filter(t => t.category !== content.category)];

    for (const template of allTemplates) {
      const match = this.matchesTemplate(content, template);
      if (match) {
        const marketTitle = this.generateMarketTitle(content, template, match);
        const endDate = this.calculateEndDate(template.timeframe);
        
        return {
          title: marketTitle,
          description: content.description,
          imageUrl: content.imageUrl,
          category: content.category,
          endDate,
          sourceUrl: content.url,
          confidence: content.confidence * template.reliability * (categoryTemplates.includes(template) ? 1.2 : 0.8)
        };
      }
    }

    // Fallback: generate generic market
    return this.generateGenericMarket(content);
  }

  private matchesTemplate(content: CrawledContent, template: MarketTemplate): RegExpMatchArray | null {
    const text = `${content.title} ${content.description}`;
    return text.match(template.pattern);
  }

  private generateMarketTitle(content: CrawledContent, template: MarketTemplate, match: RegExpMatchArray): string {
    let question = template.question;
    const endDate = this.calculateEndDate(template.timeframe);

    // Replace placeholders based on the match and template
    question = question.replace('{date}', this.formatDate(endDate));
    question = question.replace('{year}', endDate.getFullYear().toString());

    // Extract specific values from the match
    if (match[1]) {
      question = question.replace('{price}', match[1]);
      question = question.replace('{team1}', match[1].trim());
      question = question.replace('{person}', match[1].trim());
      question = question.replace('{percentage}', match[1]);
      question = question.replace('{game}', match[1].trim());
      question = question.replace('{team}', match[1].trim());
    }

    if (match[2]) {
      question = question.replace('{team2}', match[2].trim());
    }

    // Clean up any remaining placeholders
    question = question.replace(/\{[^}]+\}/g, '');
    
    return question;
  }

  private calculateEndDate(timeframe: string): Date {
    const now = new Date();
    const amount = parseInt(timeframe.match(/\d+/)?.[0] || '30');
    const unit = timeframe.match(/[a-z]+/)?.[0] || 'd';

    switch (unit) {
      case 'd':
        return new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getFullYear(), now.getMonth() + amount, now.getDate());
      case 'y':
        return new Date(now.getFullYear() + amount, now.getMonth(), now.getDate());
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  private generateGenericMarket(content: CrawledContent): MarketSuggestion | null {
    // Try to extract a yes/no question from the title
    if (content.title.includes('Will') || content.title.includes('?')) {
      return {
        title: content.title.endsWith('?') ? content.title : `${content.title}?`,
        description: content.description,
        imageUrl: content.imageUrl,
        category: content.category,
        endDate: this.calculateEndDate('90d'), // Default 90 days
        sourceUrl: content.url,
        confidence: content.confidence * 0.5 // Lower confidence for generic markets
      };
    }

    // Generate a prediction based on the title
    const genericTemplates = [
      'Will {title} happen by {date}?',
      'Will the predictions in "{title}" come true by {date}?',
      'Will {title} be successful by {date}?'
    ];

    const template = genericTemplates[Math.floor(Math.random() * genericTemplates.length)];
    const endDate = this.calculateEndDate('90d');
    
    let title = template
      .replace('{title}', content.title.toLowerCase())
      .replace('{date}', this.formatDate(endDate));

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return {
      title,
      description: content.description,
      imageUrl: content.imageUrl,
      category: content.category,
      endDate,
      sourceUrl: content.url,
      confidence: content.confidence * 0.3 // Very low confidence for auto-generated markets
    };
  }
}