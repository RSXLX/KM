'use client';

import { useSimpleTranslation } from '@/lib/i18n-simple';
import { SportsClassifiedGrid } from '@/components/sports/SportsClassifiedGrid';

interface MainContentProps {
  topBarHeight?: number;
  sidebarWidth?: number;
}

export function MainContent({ topBarHeight = 64, sidebarWidth }: MainContentProps) {
  const { t } = useSimpleTranslation();

  return (
    <main 
      className="min-h-screen bg-background transition-all duration-300"
      style={{ 
        marginTop: `${topBarHeight}px`
      }}
    >
      <div className="p-6">
        {/* Sports Only Section */}
        <section>
       <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {t('topics.sports')}
            </h1>
          </div>
          <SportsClassifiedGrid />
        </section>
      </div>
    </main>
  );
}