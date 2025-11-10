import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
}

// 创建新的开仓记录
export async function POST(req: NextRequest) {
  try {
    let payload: any = null;
    try {
      payload = await req.json();
    } catch (e: any) {
      // 兼容空体或非JSON：返回明确错误而非抛出
      return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 });
    }
    if (!payload || !payload.wallet_address || !payload.market_address || !payload.selected_team || payload.amount == null || payload.multiplier_bps == null) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }
    // 规范化类型：字符串数字转换为 number
    const normalized = {
      wallet_address: String(payload.wallet_address),
      fixture_id: payload.fixture_id != null ? Number(payload.fixture_id) : undefined,
      market_address: String(payload.market_address),
      selected_team: Number(payload.selected_team),
      amount: Number(payload.amount),
      multiplier_bps: Number(payload.multiplier_bps),
      odds_home_bps: payload.odds_home_bps != null ? Number(payload.odds_home_bps) : undefined,
      odds_away_bps: payload.odds_away_bps != null ? Number(payload.odds_away_bps) : undefined,
      transaction_signature: payload.transaction_signature ? String(payload.transaction_signature) : undefined,
    };
    if (!Number.isFinite(normalized.amount) || !Number.isFinite(normalized.multiplier_bps)) {
      return NextResponse.json({ ok: false, error: 'INVALID_NUMERIC' }, { status: 400 });
    }
  const base = getBackendBase();
    console.info('[positions] POST normalized payload', normalized);
    const resp = await fetch(`${base}/compat/positions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(normalized),
    });
    const ct = resp.headers.get('content-type') || '';
    let raw: any = null;
    try {
      raw = ct.includes('application/json') ? await resp.json() : await resp.text();
    } catch (e) {
      console.warn('[positions] backend response parse failed:', (e as any)?.message || e);
    }
    console.info('[positions] backend response', { status: resp.status, contentType: ct, raw });
    if (!resp.ok) {
      const errMsg = typeof raw === 'string' ? raw : raw?.error || 'Backend error';
      return NextResponse.json({ ok: false, error: errMsg }, { status: resp.status });
    }
    return NextResponse.json({ ok: true, data: raw?.data ?? raw });
  } catch (e: any) {
    console.error('[positions] proxy POST error:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}

// 查询用户的持仓记录
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('wallet_address');
    const status = url.searchParams.get('status') || undefined; // 'current' | 'history' | 'all' | 'open' | 'closed'
    const fixtureId = url.searchParams.get('fixture_id') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    if (!walletAddress) {
      return NextResponse.json({ ok: false, error: 'wallet_address is required' }, { status: 400 });
    }
    const base = getBackendBase();
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) qs.append('status', status);
    if (fixtureId) qs.append('fixture_id', fixtureId);
    const resp = await fetch(`${base}/compat/users/${encodeURIComponent(walletAddress)}/positions?${qs.toString()}`, { cache: 'no-store' });
    const json = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ ok: false, error: json?.error || 'Backend error' }, { status: resp.status });
    }
    const positions = json?.data?.positions ?? json?.data ?? [];
    const total = Number(json?.data?.pagination?.total ?? positions.length);
    return NextResponse.json({ ok: true, positions, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (e: any) {
    console.error('[positions] proxy GET error:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}

// 管理持仓：支持 PATCH action=close
export async function PATCH(req: NextRequest) {
  try {
    const payload = await req.json();
    const action = payload?.action;
    if (action !== 'close') {
      return NextResponse.json({ ok: false, error: 'Unsupported action' }, { status: 400 });
    }
    if (!payload?.position_id) {
      return NextResponse.json({ ok: false, error: 'position_id required' }, { status: 400 });
    }
    const base = getBackendBase();
    const resp = await fetch(`${base}/compat/positions/close`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ position_id: payload.position_id, wallet_address: payload.wallet_address, close_price: payload.close_price })
    });
    const json = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ ok: false, error: json?.error || 'Backend error' }, { status: resp.status });
    }
    return NextResponse.json({ ok: true, data: json?.data ?? json });
  } catch (e: any) {
    console.error('[positions] proxy PATCH error:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}