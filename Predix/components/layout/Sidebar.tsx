'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSimpleTranslation } from '@/lib/i18n-simple';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  BarChart3, 
  Trophy, 
  DollarSign, 
  Newspaper, 
  Puzzle,
  LogIn,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Remove external config dependency

const icons = {
  Home,
  BarChart3,
  Trophy,
  DollarSign,
  Newspaper,
  Puzzle,
  LogIn
};

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  onClose?: () => void; // 接受但不使用，保持菜单始终显示
}

export function Sidebar({ isCollapsed = false, onToggle, onClose }: SidebarProps) {
  const { t } = useSimpleTranslation();
  const pathname = usePathname();

  // Define navigation items
  const mainNav = [
    { id: 'home', label: t('nav.home'), href: '/', icon: 'Home' },
    { id: 'account-contract', label: 'My Contract', href: '/account/positions', icon: 'BarChart3' },
    { id: 'leaderboard', label: t('nav.leaderboard'), href: '/leaderboard', icon: 'Trophy' },
  ];



  const footer = [
    { id: 'footer.about', href: '/about' },
    { id: 'footer.privacy', href: '/privacy' },
    { id: 'footer.terms', href: '/terms' },
    { id: 'footer.contact', href: '/contact' }
  ];

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full sidebar-dark transition-all duration-300 z-40 overflow-hidden',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo and Toggle */}
      <div className="flex items-center justify-between p-4">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center tech-glow">
              <span className="text-primary-foreground font-bold text-sm">K</span>
            </div>
            <span className="font-bold text-xl text-foreground">K Market</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="ml-auto"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="px-2 space-y-2">
        {mainNav.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex items-center rounded-lg text-sm transition-colors',
              isCollapsed ? 'justify-center p-2' : 'space-x-3 px-3 py-2',
              pathname === item.href ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {isCollapsed ? (
              <span className="font-bold text-lg">
                {item.label.charAt(0).toUpperCase()}
              </span>
            ) : (
              <span className="min-w-0 truncate">{item.label}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {footer.map((f) => (
              <Link key={f.id} href={f.href} className="hover:text-foreground transition-colors">
                {t(f.id)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}