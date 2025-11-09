# Predix Markets - 开发文档

## 📋 项目概述

Predix Markets 是一个基于区块链的预测市场平台，用户可以对未来事件进行预测和投注。平台支持多语言、多主题分类，并提供实时数据更新和社区互动功能。

## 🎨 UI/UX 设计规范

### 整体布局结构

```
┌─────────────┬─────────────────────────────────────┐
│             │    [Search Bar]    [Login/Wallet]   │
│             ├─────────────────────────────────────┤
│  Sidebar    │                                     │
│  Menu       │           Main Content              │
│             │                                     │
│             │                                     │
│             │                                     │
└─────────────┴─────────────────────────────────────┘
```

### 颜色主题

```scss
// 主色调
$primary: #6366f1;     // 靛蓝色
$secondary: #f59e0b;   // 橙色
$success: #10b981;     // 绿色
$danger: #ef4444;      // 红色

// 中性色
$gray-50: #f9fafb;
$gray-100: #f3f4f6;
$gray-200: #e5e7eb;
$gray-800: #1f2937;
$gray-900: #111827;

// 背景
$bg-primary: #ffffff;
$bg-secondary: #f8fafc;
$bg-dark: #0f172a;
```

## 🧭 导航结构设计

### 左侧菜单栏

```typescript
interface SidebarConfig {
  mainNav: NavItem[];
  topics: TopicItem[];
  auth: AuthItem[];
  footer: FooterItem[];
}

const sidebarConfig: SidebarConfig = {
  mainNav: [
    { id: 'home', label: 'Home', href: '/', icon: 'HomeIcon' },
    { id: 'markets', label: 'Markets', href: '/markets', icon: 'ChartBarIcon' },
    { id: 'leaderboard', label: 'Leaderboard', href: '/leaderboard', icon: 'TrophyIcon' },
    { id: 'earn', label: 'Earn', href: '/earn', icon: 'CurrencyDollarIcon' },
    { id: 'news', label: 'News', href: '/news', icon: 'NewspaperIcon' },
    { id: 'integrations', label: 'Integrations', href: '/integrations', icon: 'PuzzlePieceIcon' }
  ],
  topics: [
    { id: 'crypto', label: 'Crypto', icon: '₿', color: '#f7931a' },
    { id: 'sports', label: 'Sports', icon: '⚽', color: '#22c55e' },
    { id: 'politics', label: 'Politics', icon: '🗳️', color: '#dc2626' },
    { id: 'economy', label: 'Economy', icon: '📈', color: '#059669' },
    { id: 'gaming', label: 'Gaming', icon: '🎮', color: '#8b5cf6' },
    { id: 'culture', label: 'Culture', icon: '🎭', color: '#f59e0b' },
    { id: 'tech', label: 'Tech & Science', icon: '🔬', color: '#3b82f6' }
  ],
  auth: [
    { id: 'signin', label: 'Sign In', action: 'openLoginModal' }
  ],
  footer: [
    { id: 'help', label: 'Help & Feedback', href: '/help' },
    { id: 'partner', label: 'Partner with us', href: '/partner' },
    { id: 'terms', label: 'Terms of Use', href: '/terms' },
    { id: 'privacy', label: 'Privacy Policy', href: '/privacy' }
  ]
};
```

## 🏗️ 组件架构

### 1. 左侧导航组件

```typescript
// components/layout/Sidebar.tsx
interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-6">
        <Logo collapsed={isCollapsed} />
      </div>

      {/* Main Navigation */}
      <nav className="px-4">
        <MainNavigation items={sidebarConfig.mainNav} collapsed={isCollapsed} />
        
        <Separator className="my-6" />
        
        {/* Topics Section */}
        <div className="mb-6">
          <SectionHeader title="TOPICS" collapsed={isCollapsed} />
          <TopicsNavigation items={sidebarConfig.topics} collapsed={isCollapsed} />
        </div>

        <Separator className="my-6" />

        {/* Auth Section */}
        <AuthSection items={sidebarConfig.auth} collapsed={isCollapsed} />
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <FooterNavigation items={sidebarConfig.footer} collapsed={isCollapsed} />
        <Copyright collapsed={isCollapsed} />
      </div>
    </aside>
  );
}
```

### 2. 顶部搜索和登录区域

```typescript
// components/layout/TopBar.tsx
export function TopBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const { isConnected, address } = useAccount();

  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-white border-b border-gray-200 z-40">
      <div className="flex items-center justify-between h-full px-6">
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="搜索预测市场..."
            onSearch={handleSearch}
          />
        </div>

        {/* Auth/Wallet Section */}
        <div className="flex items-center space-x-4">
          <NotificationBell />
          <LanguageSwitcher />
          
          {isConnected ? (
            <WalletDropdown address={address} />
          ) : (
            <LoginButton onClick={openLoginModal} />
          )}
        </div>
      </div>
    </header>
  );
}
```

### 3. 主内容区域布局

```typescript
// components/layout/MainContent.tsx
export function MainContent() {
  return (
    <main className="ml-64 mt-16 min-h-screen bg-gray-50">
      <div className="p-6">
        {/* 热门预测区域 */}
        <section className="mb-8">
          <SectionHeader 
            title="🔥 热门预测" 
            subtitle="最受关注的预测市场"
          />
          <TrendingPredictions />
        </section>

        {/* 分类市场区域 */}
        <section>
          <SectionHeader 
            title="📊 分类市场" 
            subtitle="按主题浏览预测市场"
          />
          <CategorySections />
        </section>
      </div>
    </main>
  );
}
```

### 4. 分类卡片滚动组件

```typescript
// components/market/CategorySections.tsx
export function CategorySections() {
  const categories = ['crypto', 'sports', 'politics', 'economy', 'gaming', 'culture', 'tech'];

  return (
    <div className="space-y-8">
      {categories.map(category => (
        <CategorySection key={category} category={category} />
      ))}
    </div>
  );
}

// components/market/CategorySection.tsx
interface CategorySectionProps {
  category: string;
}

export function CategorySection({ category }: CategorySectionProps) {
  const { data: markets, isLoading } = useMarkets({ category, limit: 10 });

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <CategoryHeader category={category} />
        <ViewAllButton category={category} />
      </div>

      {/* 横向滚动卡片列表 */}
      <div className="overflow-x-auto">
        <div className="flex space-x-4 pb-4">
          {markets?.map(market => (
            <MarketCard
              key={market.id}
              market={market}
              onUpVote={(marketId) => handleVote(marketId, 'up')}
              onDownVote={(marketId) => handleVote(marketId, 'down')}
              onCardClick={(marketId) => openMarketDetail(marketId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 5. 市场卡片组件

```typescript
// components/market/MarketCard.tsx
interface MarketCardProps {
  market: Market;
  onUpVote: (marketId: string) => void;
  onDownVote: (marketId: string) => void;
  onCardClick: (marketId: string) => void;
}

export function MarketCard({ market, onUpVote, onDownVote, onCardClick }: MarketCardProps) {
  const [showBetModal, setShowBetModal] = useState(false);

  return (
    <div className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* 卡片图片 */}
      <div className="relative h-48">
        <Image
          src={market.imageUrl}
          alt={market.title}
          fill
          className="object-cover"
        />
        <CategoryBadge category={market.category} />
      </div>

      {/* 卡片内容 */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => onCardClick(market.id)}
      >
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {market.title}
        </h3>
        
        <MarketStats market={market} />
        
        <ProbabilityBar probability={market.probability} />
      </div>

      {/* 投票按钮区域 */}
      <div className="px-4 pb-4">
        <div className="flex space-x-2">
          <VoteButton
            type="up"
            percentage={market.upPercentage}
            onClick={(e) => {
              e.stopPropagation();
              setShowBetModal(true);
            }}
          />
          <VoteButton
            type="down"
            percentage={market.downPercentage}
            onClick={(e) => {
              e.stopPropagation();
              setShowBetModal(true);
            }}
          />
        </div>
      </div>

      {/* 投注弹窗 */}
      <BetModal
        isOpen={showBetModal}
        onClose={() => setShowBetModal(false)}
        market={market}
        onBet={handleBet}
      />
    </div>
  );
}
```

### 6. 投注弹窗组件

```typescript
// components/market/BetModal.tsx
interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: Market;
  onBet: (bet: BetData) => void;
}

export function BetModal({ isOpen, onClose, market, onBet }: BetModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<'yes' | 'no'>('yes');
  const [betAmount, setBetAmount] = useState('');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end"
        >
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="w-96 h-full bg-white shadow-xl overflow-y-auto"
          >
            {/* 弹窗头部 */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">下注预测</h2>
                <CloseButton onClick={onClose} />
              </div>
            </div>

            {/* 市场信息 */}
            <div className="p-6">
              <MarketSummary market={market} />
              
              {/* 结果选择 */}
              <OutcomeSelector
                outcomes={['yes', 'no']}
                selected={selectedOutcome}
                onChange={setSelectedOutcome}
                probabilities={market.probabilities}
              />

              {/* 下注金额 */}
              <BetAmountInput
                value={betAmount}
                onChange={setBetAmount}
                maxAmount={userBalance}
              />

              {/* 预期收益 */}
              <ExpectedReturns
                amount={betAmount}
                outcome={selectedOutcome}
                odds={market.odds}
              />

              {/* 确认按钮 */}
              <ConfirmBetButton
                onConfirm={() => onBet({
                  marketId: market.id,
                  outcome: selectedOutcome,
                  amount: betAmount
                })}
                disabled={!betAmount || parseFloat(betAmount) <= 0}
              />
            </div>

            {/* 市场详细信息 */}
            <div className="p-6 bg-gray-50">
              <MarketDetails market={market} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

## 📊 数据爬取和内容映射

### 数据来源配置

```typescript
// lib/dataSources.ts
interface DataSource {
  id: string;
  name: string;
  baseUrl: string;
  category: string[];
  endpoints: {
    news: string;
    images: string;
  };
  headers?: Record<string, string>;
}

export const dataSources: DataSource[] = [
  {
    id: 'coindesk',
    name: 'CoinDesk',
    baseUrl: 'https://api.coindesk.com',
    category: ['crypto'],
    endpoints: {
      news: '/v1/news',
      images: '/v1/images'
    }
  },
  {
    id: 'espn',
    name: 'ESPN',
    baseUrl: 'https://site.api.espn.com',
    category: ['sports'],
    endpoints: {
      news: '/apis/site/v2/sports/news',
      images: '/apis/site/v2/sports/images'
    }
  },
  {
    id: 'reuters',
    name: 'Reuters',
    baseUrl: 'https://www.reuters.com',
    category: ['politics', 'economy'],
    endpoints: {
      news: '/pf/api/v3/content/fetch/articles-by-section-alias-v1',
      images: '/pf/api/v3/content/fetch/images-by-section-v1'
    }
  }
];
```

### 内容爬取服务

```typescript
// services/ContentCrawler.ts
export class ContentCrawler {
  private sources: DataSource[];

  constructor(sources: DataSource[]) {
    this.sources = sources;
  }

  async crawlContentByCategory(category: string): Promise<CrawledContent[]> {
    const relevantSources = this.sources.filter(source => 
      source.category.includes(category)
    );

    const results = await Promise.allSettled(
      relevantSources.map(source => this.crawlFromSource(source, category))
    );

    return results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value);
  }

  private async crawlFromSource(source: DataSource, category: string): Promise<CrawledContent[]> {
    try {
      // 使用 Puppeteer 或 Cheerio 进行爬取
      const response = await fetch(`${source.baseUrl}${source.endpoints.news}`, {
        headers: source.headers || {}
      });
      
      const data = await response.json();
      return this.parseContent(data, source, category);
    } catch (error) {
      console.error(`Failed to crawl from ${source.name}:`, error);
      return [];
    }
  }

  private parseContent(rawData: any, source: DataSource, category: string): CrawledContent[] {
    // 根据不同的数据源格式解析内容
    return rawData.articles?.map((article: any) => ({
      title: article.title,
      description: article.description,
      imageUrl: this.extractImageUrl(article),
      source: source.name,
      category,
      publishedAt: new Date(article.publishedAt),
      url: article.url,
      confidence: this.calculateRelevance(article, category)
    })) || [];
  }

  private extractImageUrl(article: any): string {
    // 从文章数据中提取图片URL
    return article.urlToImage || 
           article.image?.url || 
           article.multimedia?.[0]?.url || 
           '/images/placeholder.jpg';
  }

  private calculateRelevance(article: any, category: string): number {
    // 使用关键词匹配计算文章与分类的相关性
    const keywords = this.getCategoryKeywords(category);
    const text = `${article.title} ${article.description}`.toLowerCase();
    
    const matchCount = keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    ).length;
    
    return Math.min(matchCount / keywords.length, 1);
  }

  private getCategoryKeywords(category: string): string[] {
    const keywordMap: Record<string, string[]> = {
      crypto: ['bitcoin', 'ethereum', 'blockchain', 'cryptocurrency', 'defi', 'nft'],
      sports: ['football', 'basketball', 'soccer', 'baseball', 'olympics', 'championship'],
      politics: ['election', 'government', 'president', 'congress', 'policy', 'vote'],
      economy: ['stock', 'market', 'finance', 'economy', 'recession', 'inflation'],
      gaming: ['esports', 'gaming', 'tournament', 'video game', 'streamer'],
      culture: ['entertainment', 'movie', 'music', 'celebrity', 'art', 'fashion'],
      tech: ['technology', 'ai', 'software', 'startup', 'innovation', 'science']
    };
    
    return keywordMap[category] || [];
  }
}
```

### 自动化内容映射

```typescript
// services/ContentMapper.ts
export class ContentMapper {
  async mapContentToMarkets(content: CrawledContent[]): Promise<MarketSuggestion[]> {
    const suggestions: MarketSuggestion[] = [];

    for (const item of content) {
      const marketSuggestion = await this.generateMarketFromContent(item);
      if (marketSuggestion) {
        suggestions.push(marketSuggestion);
      }
    }

    return suggestions;
  }

  private async generateMarketFromContent(content: CrawledContent): Promise<MarketSuggestion | null> {
    // 使用 AI 或规则引擎生成市场预测问题
    const marketTemplates = this.getMarketTemplates(content.category);
    
    for (const template of marketTemplates) {
      if (this.matchesTemplate(content, template)) {
        return {
          title: this.generateMarketTitle(content, template),
          description: content.description,
          imageUrl: content.imageUrl,
          category: content.category,
          endDate: this.calculateEndDate(content, template),
          sourceUrl: content.url,
          confidence: content.confidence * template.reliability
        };
      }
    }

    return null;
  }

  private getMarketTemplates(category: string): MarketTemplate[] {
    const templates: Record<string, MarketTemplate[]> = {
      crypto: [
        {
          pattern: /bitcoin.*\$(\d+)/i,
          question: 'Will Bitcoin reach ${price} by ${date}?',
          timeframe: '30d',
          reliability: 0.8
        },
        {
          pattern: /ethereum.*upgrade/i,
          question: 'Will Ethereum upgrade be successful by ${date}?',
          timeframe: '90d',
          reliability: 0.7
        }
      ],
      sports: [
        {
          pattern: /([\w\s]+)\s+vs\s+([\w\s]+)/i,
          question: 'Will ${team1} beat ${team2}?',
          timeframe: '7d',
          reliability: 0.9
        }
      ],
      politics: [
        {
          pattern: /election.*(\d{4})/i,
          question: 'Will ${candidate} win the ${year} election?',
          timeframe: '365d',
          reliability: 0.8
        }
      ]
    };

    return templates[category] || [];
  }
}
```

## 🔄 实时数据更新

### WebSocket 配置

```typescript
// lib/websocket.ts
export class RealtimeService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    this.ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      this.handleReconnect();
    };
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'MARKET_UPDATE':
        // 更新市场数据
        marketStore.updateMarket(data.payload);
        break;
      case 'NEW_BET':
        // 新的投注
        marketStore.addBet(data.payload);
        break;
      case 'PRICE_UPDATE':
        // 价格更新
        marketStore.updatePrice(data.payload);
        break;
    }
  }
}
```

## 📱 响应式设计

### 断点配置

```typescript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',   // 手机横屏
      'md': '768px',   // 平板
      'lg': '1024px',  // 小型桌面
      'xl': '1280px',  // 桌面
      '2xl': '1536px'  // 大屏幕
    }
  }
};
```

### 移动端侧边栏

```typescript
// components/layout/MobileSidebar.tsx
export function MobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 移动端顶部栏 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b z-50">
        <div className="flex items-center justify-between h-full px-4">
          <button onClick={() => setIsOpen(true)}>
            <Bars3Icon className="w-6 h-6" />
          </button>
          <Logo />
          <WalletButton />
        </div>
      </div>

      {/* 侧边栏覆盖层 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="w-64 h-full bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar onClose={() => setIsOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

## 🧪 测试策略

### 组件测试

```typescript
// __tests__/components/MarketCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketCard } from '@/components/market/MarketCard';

describe('MarketCard', () => {
  const mockMarket = {
    id: '1',
    title: 'Will Bitcoin reach $100k by 2024?',
    category: 'crypto',
    probability: 0.65,
    imageUrl: '/test-image.jpg'
  };

  it('should render market information correctly', () => {
    render(
      <MarketCard
        market={mockMarket}
        onUpVote={jest.fn()}
        onDownVote={jest.fn()}
        onCardClick={jest.fn()}
      />
    );

    expect(screen.getByText(mockMarket.title)).toBeInTheDocument();
  });

  it('should call onUpVote when up button is clicked', () => {
    const onUpVote = jest.fn();
    
    render(
      <MarketCard
        market={mockMarket}
        onUpVote={onUpVote}
        onDownVote={jest.fn()}
        onCardClick={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('up-vote-button'));
    expect(onUpVote).toHaveBeenCalledWith(mockMarket.id);
  });
});
```

## 🚀 部署配置

### 环境变量

```bash
# .env.local
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_WS_URL=wss://api.predix.markets/ws
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CRAWLER_API_KEY=your_crawler_api_key
```

### Netlify 配置

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "out"

[build.environment]
  NODE_VERSION = "18"

# API 路由重定向
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

# 多语言重定向
[[redirects]]
  from = "/"
  to = "/en"
  status = 302
  force = false
  conditions = {Language = ["en"]}

[[redirects]]
  from = "/"
  to = "/zh"
  status = 302
  force = false
  conditions = {Language = ["zh"]}
```

这份开发文档提供了完整的UI设计、组件架构、数据爬取方案和部署配置。每个组件都有详细的TypeScript接口定义，确保类型安全和可维护性。