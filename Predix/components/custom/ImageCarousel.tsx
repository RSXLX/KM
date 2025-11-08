'use client'

import React, { useRef, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ImageItem {
  id: number | string;
  title?: string;
  image: React.ReactNode; // Allow Next/Image or any node
  cta?: React.ReactNode;
  href?: string; // Optional click-through link
}

interface ImageCarouselProps {
  items: ImageItem[];
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ items }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="relative w-full max-w-screen-2xl mx-auto">
  
 

      {/* Carousel */}
      <div ref={scrollerRef} className="flex gap-2 w-full max-w-full overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory box-border">
        {items.map((item, index) => (
          <div 
            key={item.id}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              transform: hoveredIndex === index ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.3s ease',
              zIndex: hoveredIndex === index ? 10 : 'auto', // Ensure hovered item is above others
            }}
            className="snap-start flex-shrink-0 w-[88vw] sm:w-[72vw] md:w-[54vw] lg:w-[36vw] xl:w-[28vw] 2xl:w-[24vw] min-w-[240px] max-w-[560px]"
          >
            <Card className="w-full">
              <CardContent className="p-0">
                <div className="relative w-full h-[clamp(120px,22vw,240px)] bg-muted overflow-hidden">
                  {item.image}
                  {item.href ? (
                    <a
                      href={item.href}
                      className="absolute inset-0 z-10"
                      aria-label={item.title ?? 'carousel-item'}
                    />
                  ) : null}
                </div>
             
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Scrollbar - always visible but non-interactive */}
      <div className="h-1 bg-transparent mt-2 w-full"></div>
    </div>
  );
};

export default ImageCarousel;