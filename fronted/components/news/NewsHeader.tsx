'use client';

import { useSimpleTranslation } from '@/lib/i18n-simple';

export function NewsHeader() {
  const { t } = useSimpleTranslation();

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('news.title')}
          </h1>
          <p className="text-muted-foreground">
            Latest news and updates from major sources
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}