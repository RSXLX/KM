'use client';

import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Brush, ReferenceLine } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface LiveOddsChartProps {
  homeCode: string;
  awayCode: string;
  data: { t: number; ts: number; home: number; away: number }[];
  liquidation: number;
  selectedTeam: 'home' | 'away' | null;
}

export function LiveOddsChart({ homeCode, awayCode, data, liquidation, selectedTeam }: LiveOddsChartProps) {
  const homeStroke = '#6A4BFF';
  const awayStroke = '#00E0A8';

  const homeWidth = selectedTeam === 'home' ? 3 : 2;
  const awayWidth = selectedTeam === 'away' ? 3 : 2;
  const homeOpacity = selectedTeam ? (selectedTeam === 'home' ? 1 : 0.8) : 1;
  const awayOpacity = selectedTeam ? (selectedTeam === 'away' ? 1 : 0.8) : 1;

  const [range, setRange] = useState<{ startIndex?: number; endIndex?: number }>({});

  const startTs = data.length ? data[0].ts : undefined;
  const endTs = data.length ? data[data.length - 1].ts : undefined;

  const formatTs = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

  const tickFormatter = (val: number) => formatTs(val);

  const [yDomainMin, yDomainMax] = useMemo(() => {
    if (!data.length) return [1, 4];
    const min = Math.min(...data.map(p => Math.min(p.home, p.away)));
    const max = Math.max(...data.map(p => Math.max(p.home, p.away)));
    const paddedMin = Math.max(1, Number((min - 0.1).toFixed(2)));
    const paddedMax = Math.min(4, Number((max + 0.1).toFixed(2)));
    return [paddedMin, paddedMax];
  }, [data]);

  return (
    <Card className="tech-card w-full min-w-0">
      <CardHeader>
        <CardTitle className="text-center text-lg">Live Odds</CardTitle>
        <div className="text-xs text-muted-foreground text-center">{formatTs(startTs)} — {formatTs(endTs)}</div>
      </CardHeader>
      <CardContent>
        <div className="h-[420px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="ts" type="number" domain={["dataMin", "dataMax"]} axisLine={false} tickLine={false} tickFormatter={tickFormatter} minTickGap={48} />
              <YAxis domain={[yDomainMin, yDomainMax]} axisLine={false} tickLine={false} tickMargin={8} />
              <Tooltip labelFormatter={(val: any) => formatTs(typeof val === 'number' ? val : Number(val))} formatter={(val: any) => (typeof val === 'number' ? val.toFixed(2) : val)} />
              <ReferenceLine y={liquidation} stroke="#9CA3AF" strokeDasharray="4 4" ifOverflow="extendDomain" label={{ position: 'right', value: 'Liquidation', fill: '#9CA3AF', fontSize: 10 }} />
              <Line type="monotone" dataKey="home" name={homeCode} stroke={homeStroke} strokeWidth={homeWidth} strokeOpacity={homeOpacity} dot={false} isAnimationActive={true} animationDuration={300} />
              <Line type="monotone" dataKey="away" name={awayCode} stroke={awayStroke} strokeWidth={awayWidth} strokeOpacity={awayOpacity} dot={false} isAnimationActive={true} animationDuration={300} />
              <Brush dataKey="ts" travellerWidth={8} height={24} startIndex={range.startIndex} endIndex={range.endIndex} onChange={(r) => setRange({ startIndex: r?.startIndex, endIndex: r?.endIndex })} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}