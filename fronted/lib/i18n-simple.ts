// Simplified i18n system without next-intl
import { useState, useEffect } from 'react';

export type Locale = 'en' | 'zh' | 'ja' | 'ko';

export const defaultLocale: Locale = 'en';

export const locales: Locale[] = ['en', 'zh', 'ja', 'ko'];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어'
};

// Simple translations - we'll use English for now
export const translations: Record<string, string> = {
  // Navigation
  'nav.home': 'Home',
  'nav.markets': 'Markets',
  'nav.leaderboard': 'Leaderboard',
  'nav.news': 'News',
  
  // Topics
  'topics.crypto': 'Crypto',
  'topics.sports': 'Sports',
  'topics.politics': 'Politics',
  'topics.economy': 'Economy',
  'topics.gaming': 'Gaming',
  'topics.culture': 'Culture',
  'topics.tech': 'Tech & Science',
  
  // Market
  'market.trending': 'Trending Predictions',
  'market.categories': 'Browse by Category',
  'market.mostActive': 'Most active prediction markets right now',
  'market.browseByTopic': 'Browse markets by topic',
  
  // Common
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.notFound': 'Not Found',
  
  // Auth
  'auth.signIn': 'Sign In',
  'auth.signOut': 'Sign Out',
  'auth.connectWallet': 'Connect Wallet',
  
  // Footer
  'footer.help': 'Help & Feedback',
  'footer.partner': 'Partner with us',
  'footer.terms': 'Terms of Use',
  'footer.privacy': 'Privacy Policy'
};

export function useSimpleTranslation() {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  useEffect(() => {
    // Try to get locale from localStorage or URL
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && locales.includes(savedLocale)) {
      setLocale(savedLocale);
    }
  }, []);

  const t = (key: string): string => {
    return translations[key] || key;
  };

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  return { locale, t, changeLocale };
}