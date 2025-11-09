'use client';

import { useSimpleTranslation } from '@/lib/i18n-simple';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LeaderboardHeader() {
  const { t } = useSimpleTranslation();

  return (
    <div className="mb-8">
      {/* Page Title */}
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        {t('leaderboard.title')}
      </h1>

      {/* Season Selector */}
      <div className="flex items-center space-x-4 mb-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center space-x-2">
              <span className="font-semibold">SZN 2</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>SZN 2 (Current)</DropdownMenuItem>
            <DropdownMenuItem>SZN 1</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="text-sm text-gray-600">
          SZN 2 (69.1k)
        </div>
      </div>
    </div>
  );
}