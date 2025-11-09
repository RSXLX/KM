import { NextRequest, NextResponse } from 'next/server';
// MySQL removed. Proxy to backend PostgreSQL service.

export const dynamic = 'force-dynamic';

function getBackendBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
}

// 处理平仓请求
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const base = getBackendBase();
    const resp = await fetch(`${base}/compat/positions/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await resp.json();
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    console.error('[positions/close] API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

// 查询平仓记录
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('wallet_address');
    const positionId = url.searchParams.get('position_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    if (!walletAddress && !positionId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'wallet_address or position_id is required' 
      }, { status: 400 });
    }

    // Proxy to backend compat endpoint
    if (!walletAddress && !positionId) {
      return NextResponse.json({ ok: false, error: 'wallet_address or position_id is required' }, { status: 400 });
    }
    const base = getBackendBase();
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      type: 'CLOSE',
    });
    let urlPath = '';
    if (walletAddress) {
      urlPath = `${base}/compat/users/${encodeURIComponent(walletAddress)}/positions?${qs.toString()}`;
    } else {
      urlPath = `${base}/compat/positions/${encodeURIComponent(positionId!)}?${qs.toString()}`;
    }
    const resp = await fetch(urlPath, { cache: 'no-store' });
    const json = await resp.json();
    return NextResponse.json(json, { status: resp.status });

  } catch (error) {
    console.error('[positions/close] API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}