'use client';

import { useSimpleTranslation } from '@/lib/i18n-simple';
import { sidebarConfig } from '@/lib/config';
import { CategorySection } from './CategorySection';

export function CategorySections() {
  const { t } = useSimpleTranslation();

  return (
    <div className="space-y-8">
      {sidebarConfig.topics.map((topic) => (
        <CategorySection
          key={topic.id}
          category={topic.id}
          title={t(`topics.${topic.id}`)}
          icon={topic.icon}
          color={topic.color}
        />
      ))}
    </div>
  );
}