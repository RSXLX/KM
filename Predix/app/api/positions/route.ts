import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export const dynamic = 'force-dynamic';

function parseMysqlUrl(url: string) {
  const u = new URL(url);
  const database = u.pathname.replace(/^\//, '') || undefined;
  const ssl = u.searchParams.get('ssl');
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
    ssl: ssl === 'true' ? {} : undefined,
    connectionLimit: 10,
  } as any;
}

// 创建新的开仓记录
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // 验证必需字段
    if (!data.wallet_address || !data.market_address || !data.selected_team || 
        !data.amount || !data.multiplier_bps || !data.transaction_signature) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const mysqlUrl = process.env.MYSQL_URL;
    if (!mysqlUrl) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Database not configured' 
      }, { status: 500 });
    }

    const config = parseMysqlUrl(mysqlUrl);
    const pool = await mysql.createPool(config);

    // 幂等校验：基于 transaction_signature
    if (data.transaction_signature) {
      const [dupRows] = await pool.query(
        'SELECT id FROM positions WHERE transaction_signature = ?',
        [data.transaction_signature]
      );
      if ((dupRows as any[]).length > 0) {
        return NextResponse.json({
          ok: true,
          position_id: (dupRows as any[])[0].id,
          message: 'Duplicate transaction, returning existing position'
        }, { status: 200 });
      }
    }

    // 使用单连接事务，避免并发下状态不一致
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 首先检查用户是否存在，不存在则创建
      const [userRows] = await conn.query(
        'SELECT id FROM users WHERE wallet_address = ? FOR UPDATE',
        [data.wallet_address]
      );

      let userId: number;
      if ((userRows as any[]).length === 0) {
        const [userResult] = await conn.query(
          'INSERT INTO users (wallet_address) VALUES (?)',
          [data.wallet_address]
        );
        userId = (userResult as any).insertId;
      } else {
        userId = (userRows as any[])[0].id;
      }

      // 获取市场信息并加锁
      const [marketRows] = await conn.query(
        'SELECT id, state, status, end_date, close_time FROM markets WHERE market_address = ? FOR UPDATE',
        [data.market_address]
      );

      if ((marketRows as any[]).length === 0) {
        await conn.rollback();
        return NextResponse.json({ 
          ok: false, 
          error: 'Market not found',
          code: 'MARKET_NOT_FOUND'
        }, { status: 404 });
      }

      const market = (marketRows as any[])[0];
      const marketId = market.id;
      const isOpen = ((market.state ?? market.status) === 1);
      const endTs = market.close_time ? new Date(market.close_time).getTime() : (market.end_date ? new Date(market.end_date).getTime() : undefined);
      const nowTs = Date.now();
      if (!isOpen || (endTs && nowTs >= endTs)) {
        await conn.rollback();
        return NextResponse.json({ 
          ok: false, 
          error: 'Market is not open for placing positions',
          code: 'MARKET_CLOSED'
        }, { status: 409 });
      }

      // 计算预期赔付
      const openPriceBps = data.selected_team === 1 ? data.odds_home_bps : data.odds_away_bps;
      if (!openPriceBps) {
        await conn.rollback();
        return NextResponse.json({ ok: false, error: 'Missing odds for selected team', code: 'MISSING_ODDS' }, { status: 400 });
      }
      const multiplier = Number(data.multiplier_bps || 10000) / 10000;
      const payoutExpected = Math.round(Number(data.amount) * (Number(openPriceBps) / 10000) * multiplier);

      // 插入开仓记录
      const [result] = await conn.query(
        `INSERT INTO positions (
          user_id, market_id, wallet_address, market_address, 
          position_type, selected_team, amount, multiplier_bps,
          odds_home_bps, odds_away_bps, payout_expected,
          status, transaction_signature, timestamp
        ) VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, 1, ?, NOW())`,
        [
          userId, marketId, data.wallet_address, data.market_address,
          data.selected_team, data.amount, data.multiplier_bps,
          data.odds_home_bps ?? null, data.odds_away_bps ?? null,
          (data.payout_expected ?? payoutExpected), data.transaction_signature
        ]
      );

      const positionId = (result as any).insertId;
      await conn.commit();

      return NextResponse.json({ 
        ok: true, 
        position_id: positionId,
        payout_expected: (data.payout_expected ?? payoutExpected),
        message: 'Position created successfully' 
      });

    } catch (dbError) {
      await conn.rollback();
      console.error('[positions] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database operation failed',
        code: 'DB_ERROR'
      }, { status: 500 });
    } finally {
      conn.release();
      await pool.end();
    }

  } catch (error) {
    console.error('[positions] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 查询用户的持仓记录
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('wallet_address');
    const marketAddress = url.searchParams.get('market_address');
    const status = url.searchParams.get('status');
    const positionType = url.searchParams.get('position_type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    if (!walletAddress && !marketAddress) {
      return NextResponse.json({ 
        ok: false, 
        error: 'wallet_address or market_address is required' 
      }, { status: 400 });
    }

    const mysqlUrl = process.env.MYSQL_URL;
    if (!mysqlUrl) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Database not configured' 
      }, { status: 500 });
    }

    const config = parseMysqlUrl(mysqlUrl);
    const pool = await mysql.createPool(config);

    try {
      // 构建查询条件
      let whereConditions = [];
      let queryParams = [];

      if (walletAddress) {
        whereConditions.push('u.wallet_address = ?');
        queryParams.push(walletAddress);
      }

      if (marketAddress) {
        whereConditions.push('m.market_address = ?');
        queryParams.push(marketAddress);
      }

      if (status) {
        whereConditions.push('p.status = ?');
        queryParams.push(parseInt(status));
      }

      if (positionType) {
        whereConditions.push('p.position_type = ?');
        queryParams.push(positionType);
      }

      const whereClause = whereConditions.length > 0 ? 
        'WHERE ' + whereConditions.join(' AND ') : '';

      // 查询总数
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total
         FROM positions p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN markets m ON p.market_id = m.id
         ${whereClause}`,
        queryParams
      );
      const total = (countResult as any[])[0].total;

      // 查询数据
      const [rows] = await pool.query(
        `SELECT 
          p.*,
          u.username,
          m.home_name,
          m.away_name,
          m.start_time,
          m.state as market_state
        FROM positions p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN markets m ON p.market_id = m.id
        ${whereClause}
        ORDER BY p.timestamp DESC
        LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      return NextResponse.json({
        ok: true,
        positions: rows,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      });

    } catch (dbError) {
      console.error('[positions] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database query failed' 
      }, { status: 500 });
    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('[positions] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}