import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 兼容旧路径：重定向到统一的 /api/positions
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get('wallet_address');
  if (!walletAddress) {
    return NextResponse.json({ ok: false, error: 'wallet_address is required' }, { status: 400 });
  }
  const fixtureId = url.searchParams.get('fixture_id');
  const status = url.searchParams.get('status');
  const page = url.searchParams.get('page') || '1';
  const limit = url.searchParams.get('limit') || '50';
  const qs = new URLSearchParams({ wallet_address: walletAddress, page, limit });
  if (fixtureId) qs.append('fixture_id', fixtureId);
  if (status) qs.append('status', status);
  return NextResponse.redirect(new URL(`/api/positions?${qs.toString()}`, req.url));
}