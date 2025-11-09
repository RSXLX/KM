'use client';

import { useSimpleTranslation } from '@/lib/i18n-simple';

export function MarketsHeader() {
  const { t } = useSimpleTranslation();

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('nav.markets')}
          </h1>
          <p className="text-muted-foreground">
            Explore all prediction market categories
          </p>
        </div>
      </div>
    </div>
  );
}