export type CarouselItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  href: string;
  order: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CarouselResponse = {
  ok: boolean;
  items: CarouselItem[];
  error?: string;
};

export type CarouselCreatePayload = Omit<CarouselItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type CarouselUpdatePayload = Partial<CarouselItem> & { id: string };

export type CarouselConfig = {
  // card sizing and spacing
  scale?: number; // 1.5 means 150% width compared to base
  paddingPx?: number; // default 24
  radiusPx?: number; // default 12
  shadow?: string; // default '0 8px 24px rgba(0,0,0,0.12)'
  gapPx?: number; // space between cards
  autoplayMs?: number; // 0 to disable, e.g., 4000 for auto play
  preloadAdjacent?: boolean; // preload next/prev images
  maxVisible?: number; // maximum visible cards concurrently (default 3)
};