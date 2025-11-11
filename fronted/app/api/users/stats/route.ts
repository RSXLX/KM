import { NextRequest, NextResponse } from 'next/server';
// MySQL removed. Proxy to backend PostgreSQL service.

export const dynamic = 'force-dynamic';

function getBackendBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
}

// 获取用户统计数据
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('wallet_address');

    if (!walletAddress) {
      return NextResponse.json({ 
        ok: false, 
        error: 'wallet_address is required' 
      }, { status: 400 });
    }

    const base = getBackendBase();
    const resp = await fetch(`${base}/users/${encodeURIComponent(walletAddress)}/stats`, { cache: 'no-store' });
    const ct = resp.headers.get('content-type') || '';
    let raw: any = null;
    try {
      raw = ct.includes('application/json') ? await resp.json() : await resp.text();
    } catch (e: any) {
      raw = null;
    }

    if (!resp.ok) {
      const msg = typeof raw === 'string' ? raw : raw?.error || 'Backend error';
      // 后端 404 映射为默认空统计，避免前端抛错
      if (resp.status === 404) {
        return NextResponse.json({ ok: true, stats: {
          total_positions: 0,
          open_positions: 0,
          closed_positions: 0,
          won_positions: 0,
          lost_positions: 0,
          total_volume: 0,
          total_pnl: 0,
          total_fees_paid: 0,
          win_rate: 0,
        } }, { status: 200 });
      }
      return NextResponse.json({ ok: false, error: msg }, { status: resp.status });
    }

    const data = raw?.data ?? raw ?? {};
    const stats = data?.stats ?? data;
    return NextResponse.json({ ok: true, stats }, { status: 200 });

  } catch (error) {
    console.error('[users/stats] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 更新用户统计数据（通常由后台任务调用）
export async function POST(_req: NextRequest) {
  return NextResponse.json({ ok: false, error: 'Not implemented. Use backend.' }, { status: 501 });
}