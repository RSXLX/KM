export type MockFixture = {
  id: string | number;
  title: string;
  sport: string;
  league?: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | Date;
  status?: 'pre' | 'live' | 'final';
  preOdds?: { home: number; away: number; draw?: number } | null;
  liveOdds?: { home: number; away: number; draw?: number } | null;
};

export async function fetchFixtures(params?: { status?: string; sport?: string; league?: string; q?: string; page?: number; limit?: number }) {
  const { apiClient } = await import('@/lib/apiClient');
  const res = await apiClient.get('/api/sports/fixtures', { query: params ?? {}, timeoutMs: 10000 });
  if (!res || res.ok === false) throw new Error(res?.error || 'fetch fixtures failed');
  const fixtures: MockFixture[] = Array.isArray(res.fixtures) ? res.fixtures : [];
  return fixtures;
}

export async function getFixtureById(id: string | number): Promise<MockFixture | undefined> {
  const fid = String(id).trim();
  const fixtures = await fetchFixtures({ page: 1, limit: 100, q: fid });
  // 优先精确匹配，其次尾部数字匹配
  const exact = fixtures.find(f => String(f.id) === fid);
  if (exact) return exact;
  const tail = fid.replace(/^market_/i, '').replace(/^0+/, '');
  return fixtures.find(f => String(f.id).match(/\d+$/)?.[0] === tail);
}