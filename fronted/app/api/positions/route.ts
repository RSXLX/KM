import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
}

// 创建新的开仓记录
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload.wallet_address || !payload.market_address || !payload.selected_team || !payload.amount || !payload.multiplier_bps) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }
    const base = getBackendBase();
    const resp = await fetch(`${base}/compat/positions/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ ok: false, error: json?.error || 'Backend error' }, { status: resp.status });
    }
    return NextResponse.json({ ok: true, data: json?.data ?? json });
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
    if (!walletAddress) {
      return NextResponse.json({ ok: false, error: 'wallet_address is required' }, { status: 400 });
    }
    const base = getBackendBase();
    const resp = await fetch(`${base}/compat/users/${walletAddress}/positions`, { cache: 'no-store' });
    const json = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ ok: false, error: json?.error || 'Backend error' }, { status: resp.status });
    }
    return NextResponse.json({ ok: true, positions: json?.data ?? [] });
  } catch (e: any) {
    console.error('[positions] proxy GET error:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}