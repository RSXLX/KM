'use client';

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, ReferenceLine, Cell, ReferenceDot } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface OddsChartProps {
  homeCode: string;
  awayCode: string;
  odds: { home: number; away: number; liquidation: number };
  selectedTeam: 'home' | 'away' | null;
}

export function OddsChart({ homeCode, awayCode, odds, selectedTeam }: OddsChartProps) {
  const data = [
    { name: homeCode, odds: odds.home },
    { name: awayCode, odds: odds.away }
  ];

  const ticks = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5];

  return (
    <Card className="tech-card w-full min-w-0">
      <CardHeader>
        <CardTitle className="text-center text-lg">Pre-Game Betting Odds</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[420px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 40, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="homeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C5CFF" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#7C5CFF" stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id="awayGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.25} />
                </linearGradient>
              </defs>

              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis
                orientation="right"
                axisLine={false}
                tickLine={false}
                domain={[1, 3.5]}
                ticks={ticks}
                tickFormatter={(v: number) => v.toFixed(1)}
              />

              <Bar dataKey="odds" radius={[6, 6, 0, 0]}>
                {data.map((entry, index) => {
                  const isHome = entry.name === homeCode;
                  const isSelected = (selectedTeam === 'home' && isHome) || (selectedTeam === 'away' && !isHome);
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isHome ? 'url(#homeGradient)' : 'url(#awayGradient)'}
                      opacity={selectedTeam ? (isSelected ? 1 : 0.6) : 1}
                      stroke={isSelected ? '#ffffff' : undefined}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                  );
                })}
              </Bar>

              {/* Top circle markers */}
              <ReferenceDot x={homeCode} y={odds.home} r={8} fill="#A78BFA" stroke="#ffffff" />
              <ReferenceDot x={awayCode} y={odds.away} r={8} fill="#34D399" stroke="#ffffff" />

              {/* Liquidation dashed line with label on right */}
              <ReferenceLine
                y={odds.liquidation}
                stroke="#FF4757"
                strokeDasharray="6 6"
                ifOverflow="extendDomain"
                label={{ value: odds.liquidation.toFixed(2), position: 'right', fill: '#fff' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-destructive">Liquidation Odds: {odds.liquidation.toFixed(2)}</p>
        </div>
      </CardContent>
    </Card>
  );
}