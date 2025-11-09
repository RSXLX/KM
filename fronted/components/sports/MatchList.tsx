'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface MatchListItem {
  id: string;
  teams: { home: string; away: string };
  odds: { home: number; away: number };
}

interface MatchListProps {
  matches: MatchListItem[];
}

export function MatchList({ matches }: MatchListProps) {
  return (
    <Card className="tech-card mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Upcoming Fixtures</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {matches.map((m) => (
            <Link key={m.id} href={`/football/${m.id}`} className="block">
              <div className="flex items-center justify-between p-3 rounded-md hover:bg-accent transition-colors border">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{m.teams.home}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-semibold">{m.teams.away}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="mr-3">Home: {m.odds.home}</span>
                  <span>Away: {m.odds.away}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}