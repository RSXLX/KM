import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
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
    console.error('[positions/close] proxy POST error:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}