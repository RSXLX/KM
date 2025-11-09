'use client';

import { useState } from 'react';
import { useSimpleTranslation } from '@/lib/i18n-simple';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  className?: string;
  onSearch?: (query: string) => void;
}

export function SearchBar({ className, onSearch }: SearchBarProps) {
  const { t } = useSimpleTranslation();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = () => {
    if (query.trim()) {
      onSearch?.(query.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setQuery('');
    onSearch?.('');
  };

  return (
    <div className={cn('relative flex-1 max-w-2xl', className)}>
      <div className={cn(
        'relative flex items-center',
        isFocused && 'ring-2 ring-primary ring-offset-2 rounded-lg'
      )}>
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <Input
          type="text"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="pl-10 pr-20 h-11 bg-input rounded-lg text-foreground placeholder:text-muted-foreground"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-12 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        <Button
          onClick={handleSearch}
          size="sm"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Search suggestions/results dropdown can be added here */}
      {isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto glass-effect">
          {/* Recent searches */}
          <div className="p-3">
            <h4 className="text-sm font-medium text-popover-foreground mb-2">
              {t('search.recentSearches')}
            </h4>
            <div className="space-y-1">
              {['Bitcoin price prediction', 'NFL championship', 'Election 2024'].map((search) => (
                <button
                  key={search}
                  onClick={() => setQuery(search)}
                  className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-1 transition-colors"
                >
                  {search}
                </button>
              ))}
            </div>
          </div>
          
          {/* No results state */}
          {query && (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">{t('search.noResults')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}