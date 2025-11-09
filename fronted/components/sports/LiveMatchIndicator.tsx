'use client';

import React from 'react';

export function LiveMatchIndicator({ isLive }: { isLive: boolean }) {
  if (!isLive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
        Scheduled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/30 text-xs text-emerald-500 bg-emerald-500/10">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      Live
    </span>
  );
}