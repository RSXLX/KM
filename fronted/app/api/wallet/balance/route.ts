import { NextRequest, NextResponse } from 'next/server';
import { getConnection, getMintBalances, getSolanaEndpoint } from '@/lib/solana';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const address = url.searchParams.get('address');
    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    // Support comma-separated list via `mints` query param
    const mintsParam = url.searchParams.get('mints') || '';
    const mints = mintsParam
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const endpoint = getSolanaEndpoint();
    const connection = getConnection('confirmed');

    // Fetch balances (base units as strings, decimals provided by chain)
    const balances = await getMintBalances(address, mints);

    return NextResponse.json({
      address,
      network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
      endpoint,
      balances,
      lastUpdatedAt: Date.now(),
    });
  } catch (e: any) {
    console.error('[API/wallet/balance] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}