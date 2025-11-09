import { SidebarConfig } from '@/types';

export const sidebarConfig: SidebarConfig = {
  mainNav: [
    { id: 'home', label: 'Home', href: '/', icon: 'Home' },
    { id: 'markets', label: 'Markets', href: '/markets', icon: 'BarChart3' },
    { id: 'leaderboard', label: 'Leaderboard', href: '/leaderboard', icon: 'Trophy' },
    { id: 'news', label: 'News', href: '/news', icon: 'Newspaper' }
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
    { id: 'signin', label: 'Sign In', action: 'openLoginModal', icon: 'LogIn' }
  ],
  footer: [
    { id: 'help', label: 'Help & Feedback', href: '/help' },
    { id: 'partner', label: 'Partner with us', href: '/partner' },
    { id: 'terms', label: 'Terms of Use', href: '/terms' },
    { id: 'privacy', label: 'Privacy Policy', href: '/privacy' }
  ]
};