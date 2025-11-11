import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { EnhancedCarousel } from '@/components/ui/EnhancedCarousel';
import type { CarouselItem } from '@/types/carousel';

describe('EnhancedCarousel', () => {
  const items: CarouselItem[] = [
    { id: '1', title: 'Card A', imageUrl: '/logo.svg', href: '/a', order: 1, enabled: true },
    { id: '2', title: 'Card B', imageUrl: '/logo.svg', href: '/b', order: 2, enabled: true },
  ];

  it('renders current card title', () => {
    render(<EnhancedCarousel items={items} />);
    expect(screen.getByText('Card A')).toBeTruthy();
  });
});