export interface Market {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  endDate: Date;
  resolved: boolean;
  winningOutcome?: number;
  totalVolume: number;
  participants: number;
  probability: number;
  upPercentage: number;
  downPercentage: number;
  creator: string;
  source?: string;
  sourceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bet {
  id: string;
  marketId: string;
  userAddress: string;
  outcome: 'yes' | 'no';
  amount: number;
  price: number;
  createdAt: Date;
}

export interface User {
  address: string;
  balance: number;
  totalBets: number;
  accuracy: number;
  points: number;
  rank?: number;
}

export interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon: string;
  action?: string;
}

export interface TopicItem {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export interface FooterItem {
  id: string;
  label: string;
  href: string;
}

export interface SidebarConfig {
  mainNav: NavItem[];
  topics: TopicItem[];
  auth: NavItem[];
  footer: FooterItem[];
}

export interface CrawledContent {
  title: string;
  description: string;
  imageUrl: string;
  source: string;
  category: string;
  publishedAt: Date;
  url: string;
  confidence: number;
}

export interface MarketSuggestion {
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  endDate: Date;
  sourceUrl?: string;
  confidence: number;
}

export type Locale = 'en' | 'zh' | 'ja' | 'ko';