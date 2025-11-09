import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 已迁移至 PostgreSQL 后端（Actix），当前路由仅作为代理层使用

// 创建或更新市场记录
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // 验证必需字段
    if (!data.market_address || !data.home_code || !data.away_code || 
        !data.start_time || !data.close_time || !data.odds_home_bps || 
        !data.odds_away_bps || !data.max_exposure) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // 目前后端未开放创建/更新市场的公开接口，返回未实现
    return NextResponse.json({ ok: false, error: 'Not implemented in frontend API. Use backend (Actix) service.' }, { status: 501 });

  } catch (error) {
    console.error('[markets] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 查询市场列表
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const marketAddress = url.searchParams.get('market_address');
    const state = url.searchParams.get('state');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (marketAddress) qs.append('market_address', marketAddress);
    if (state) qs.append('state', state);

    // 统一代理到后端兼容接口
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
    try {
      const resp = await fetch(`${base}/compat/markets?${qs.toString()}`, { cache: 'no-store' });
      const json = await resp.json();
      if (!resp.ok) {
        return NextResponse.json({ ok: false, error: json?.error || 'Backend proxy failed' }, { status: resp.status });
      }
      const data = Array.isArray(json?.data) ? json.data : [];
      return NextResponse.json({
        ok: true,
        markets: data,
        pagination: {
          page,
          limit,
          total: data.length,
          total_pages: 1,
        }
      }, { status: 200 });
    } catch (e: any) {
      console.error('[markets] proxy error:', e);
      return NextResponse.json({ ok: false, error: 'Backend proxy failed' }, { status: 500 });
    }

  } catch (error) {
    console.error('[markets] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 更新市场状态（结算等）
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data.market_address) {
      return NextResponse.json({ 
        ok: false, 
        error: 'market_address is required' 
      }, { status: 400 });
    }

    // 后端控制市场状态更新；当前前端API不再直接更新数据库
    return NextResponse.json({ ok: false, error: 'Not implemented in frontend API. Use backend (Actix) service.' }, { status: 501 });

  } catch (error) {
    console.error('[markets] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}