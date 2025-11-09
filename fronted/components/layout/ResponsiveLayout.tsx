'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MainContent } from './MainContent';
import { MobileSidebar } from './MobileSidebar';

interface ResponsiveLayoutProps {
  children?: React.ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sidebarWidth = sidebarCollapsed ? 64 : 256;
  const topBarHeight = 64;

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Mobile Sidebar */}
        <MobileSidebar />

        {/* Mobile Main Content */}
        <div className="flex-1 mt-16">
          {children || <MainContent sidebarWidth={0} topBarHeight={64} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Desktop Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <TopBar sidebarWidth={sidebarWidth} />

        {/* Main Content */}
        <div 
          style={{ 
            marginLeft: `${sidebarWidth}px`,
            marginTop: `${topBarHeight}px`
          }}
          className="min-h-screen bg-background transition-all duration-300"
        >
          {children || <MainContent sidebarWidth={sidebarWidth} topBarHeight={topBarHeight} />}
        </div>
      </div>
    </div>
  );
}