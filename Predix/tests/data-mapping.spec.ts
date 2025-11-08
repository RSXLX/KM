import { describe, it, expect } from 'vitest';
import { fromActiveToLiveMatch, normalizeOdds } from '@/lib/data-mapping';
import { orderToLegacyPosition } from '@/lib/bets';

describe('data mapping', () => {
  it('maps ActiveMarket to LiveMatch', () => {
    const am = { market_id: 1001, title: 'Lakers vs Celtics', category: 'NBA' };
    const lm = fromActiveToLiveMatch(am);
    expect(lm.id).toBe('1001');
    expect(lm.sport).toBe('NBA');
    expect(lm.teams.home.name).toBe('Lakers');
    expect(lm.teams.away.name).toBe('Celtics');
    expect(lm.status.isLive).toBe(true);
  });

  it('normalizes odds with moneyline preferred', () => {
    const resp = { marketId: 1001, moneyline: { home: 1.85, away: 1.95 }, timestamp: 1, source: 'db' } as any;
    const o = normalizeOdds(resp);
    expect(o.home).toBe(1.85);
    expect(o.away).toBe(1.95);
  });

  it('normalizes odds with bps fallback', () => {
    const resp = { marketId: 1001, odds_a: 185, odds_b: 195, timestamp: 1, source: 'db' } as any;
    const o = normalizeOdds(resp);
    expect(o.home).toBe(1.85);
    expect(o.away).toBe(1.95);
  });

  it('maps order to legacy position', () => {
    const order = {
      orderId: 123,
      userAddress: '0xuser',
      marketId: 1001,
      amount: '10000',
      odds: 185,
      option: 1,
      potentialPayout: '18500',
      settled: false,
      claimed: false,
      txHash: '0xabc',
    };
    const pos = orderToLegacyPosition(order as any);
    expect(pos.id).toBe(123);
    expect(pos.wallet_address).toBe('0xuser');
    expect(pos.amount).toBe(10000);
    expect(pos.multiplier_bps).toBe(185);
    expect(pos.payout_expected).toBe(18500);
    expect(pos.position_type).toBe('OPEN');
  });
});