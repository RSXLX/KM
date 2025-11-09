import { NextRequest, NextResponse } from 'next/server';
// MySQL removed. Proxy to backend PostgreSQL service and map to bets.

export const dynamic = 'force-dynamic';

function getBackendBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
}

// 查询用户的投注记录
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('wallet_address');
    const fixtureId = url.searchParams.get('fixture_id');
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    if (!walletAddress) {
      return NextResponse.json({ 
        ok: false, 
        error: 'wallet_address is required' 
      }, { status: 400 });
    }

    const base = getBackendBase();
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    // Optional filters forwarded as hints; backend may ignore
    if (fixtureId) qs.append('fixture_id', fixtureId);
    if (status) qs.append('status', status);
    const resp = await fetch(`${base}/compat/users/${encodeURIComponent(walletAddress)}/positions?${qs.toString()}`, { cache: 'no-store' });
    const json = await resp.json();
    const positions = json?.data ?? json?.positions ?? [];

    // Map positions to MyBet expected structure
    const formattedBets = (positions as any[]).map((bet: any) => {
      let odds = 1.85;
      if (bet?.odds_home_bps && bet?.selected_team === 1) odds = bet.odds_home_bps / 10000;
      else if (bet?.odds_away_bps && bet?.selected_team === 2) odds = bet.odds_away_bps / 10000;

      const multiplier = bet?.multiplier_bps ? bet.multiplier_bps / 10000 : 1;
      const expectedPayout = bet?.payout_expected || (Number(bet?.amount || 0) * odds * multiplier);
      const homeTeam = bet?.market?.home_team || '主队';
      const awayTeam = bet?.market?.away_team || '客队';
      const teamName = bet?.selected_team === 1 ? homeTeam : awayTeam;

      return {
        id: bet?.id || bet?.bet_address || `bet_${Date.now()}_${Math.random()}`,
        matchId: bet?.fixture_id || bet?.matchId || 'unknown',
        fixtureId: bet?.fixture_id || bet?.matchId || 'unknown',
        homeTeam,
        awayTeam,
        selectedTeam: bet?.selected_team === 1 ? 'home' : 'away',
        teamName,
        odds,
        amount: Number(bet?.amount || 0),
        multiplier,
        expectedPayout,
        type: bet?.position_type || 'OPEN',
        status: bet?.confirmation_status === 'confirmed' ? 'confirmed' : (bet?.status === 1 ? 'confirmed' : 'pending'),
        timestamp: bet?.created_at || bet?.timestamp || new Date().toISOString(),
        transactionSignature: bet?.transaction_signature || bet?.signature,
        pnl: bet?.pnl || 0,
      };
    });

    const total = Number(json?.pagination?.total ?? formattedBets.length);
    return NextResponse.json({ ok: true, bets: formattedBets, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } }, { status: 200 });

  } catch (error) {
    console.error('[bets] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}