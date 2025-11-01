'use client';

import dynamic from 'next/dynamic';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from './SearchBar';
import { LanguageSwitcher } from './LanguageSwitcher';
import { WalletButton } from '@/components/wallet/WalletButton';

const WalletButtonNoSSR = dynamic(() => import('@/components/wallet/WalletButton').then(m => m.WalletButton), { ssr: false });

interface TopBarProps {
  sidebarWidth?: number;
}

export function TopBar({ sidebarWidth = 256 }: TopBarProps) {
  const handleSearch = (query: string) => {
    // Handle search functionality
    console.log('Search query:', query);
  };

  return (
    <header 
      className="fixed top-0 right-0 h-16 bg-background z-30 transition-all duration-300"
      style={{ left: `${sidebarWidth}px` }}
    >
      <div className="flex items-center justify-between h-full px-6">
        {/* Search Bar */}
        <SearchBar onSearch={handleSearch} />

        {/* Right side actions */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs"></span>
          </Button>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Wallet Connection */}
          <WalletButtonNoSSR />
        </div>
      </div>
    </header>
  );
}