import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendBase() {
  // 兼容多种环境变量写法：
  // - 'http://localhost:8080' => 自动补全为 'http://localhost:8080/api/v1'
  // - 'http://localhost:8080/api' => 自动补全为 'http://localhost:8080/api/v1'
  // - 'http://localhost:8080/api/v1' => 原样使用
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

// Proxy GET /api/sports/fixtures -> backend /api/v1/sports/fixtures
// Supports: status, sport, league, q, page, limit, fixture_id (client-side filter)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const sport = url.searchParams.get('sport') || undefined;
    const league = url.searchParams.get('league') || undefined;
    const q = url.searchParams.get('q') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const fixtureId = url.searchParams.get('fixture_id') || undefined;

    const base = getBackendBase();
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) qs.append('status', status);
    if (sport) qs.append('sport', sport);
    if (league) qs.append('league', league);
    if (q) qs.append('q', q);

    const resp = await fetch(`${base}/sports/fixtures?${qs.toString()}`, { cache: 'no-store' });
    const ct = resp.headers.get('content-type') || '';
    let raw: any = null;
    try { raw = ct.includes('application/json') ? await resp.json() : await resp.text(); } catch {}
    if (!resp.ok) {
      const errMsg = typeof raw === 'string' ? raw : raw?.error || 'Backend error';
      return NextResponse.json({ ok: false, error: errMsg }, { status: resp.status });
    }
    // Filter by fixture_id on client side if provided
    let fixtures: any[] = Array.isArray(raw?.data?.fixtures) ? raw.data.fixtures : Array.isArray(raw?.fixtures) ? raw.fixtures : [];
    if (fixtureId) {
      const fid = String(fixtureId).replace(/^market_/i, '').replace(/^0+/, '');
      fixtures = fixtures.filter((f) => String(f?.id).replace(/^0+/, '') === fid || String(f?.id).match(/\d+$/)?.[0] === fid);
    }
    const total = Number(raw?.data?.pagination?.total ?? fixtures.length);
    return NextResponse.json({ ok: true, fixtures, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (e: any) {
    console.error('[sports/fixtures] proxy GET error:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}