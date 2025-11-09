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
    const json = await resp.json();
    return NextResponse.json(json, { status: resp.status });

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