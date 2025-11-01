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
      // 构建查询条件 - 需要通过users表来查找wallet_address
      let whereConditions = ['u.wallet_address = ?'];
      let queryParams = [walletAddress];

      // Note: markets table doesn't have fixture_id column, using title instead
      if (fixtureId) {
        whereConditions.push('m.title LIKE ?');
        queryParams.push(`%${fixtureId}%`);
      }

      // Note: positions table doesn't have confirmation_status, removing this filter for now
      // if (status) {
      //   whereConditions.push('p.confirmation_status = ?');
      //   queryParams.push(status);
      // }

      const whereClause = 'WHERE ' + whereConditions.join(' AND ');

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

      // 查询数据 - 使用实际存在的列
      const [rows] = await pool.query(
        `SELECT 
          p.id,
          p.user_id,
          p.market_id,
          p.side,
          p.shares,
          p.avg_price,
          p.total_cost,
          p.realized_pnl,
          p.created_at,
          p.updated_at,
          u.wallet_address,
          u.username,
          m.id as market_id,
          m.title as market_title,
          m.description as market_description,
          m.end_date,
          m.status as market_status
        FROM positions p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN markets m ON p.market_id = m.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      // 格式化数据 - 映射到实际存在的列
      const formattedBets = (rows as any[]).map(row => ({
        id: row.id,
        user_id: row.user_id,
        market_id: row.market_id,
        fixture_id: row.fixture_id,
        wallet_address: row.wallet_address,
        username: row.username,
        side: row.side, // 'YES' or 'NO'
        shares: parseFloat(row.shares),
        avg_price: parseFloat(row.avg_price),
        total_cost: parseFloat(row.total_cost),
        realized_pnl: row.realized_pnl ? parseFloat(row.realized_pnl) : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        market: {
          id: row.market_id,
          title: row.market_title,
          description: row.market_description,
          end_date: row.end_date,
          status: row.market_status
        }
      }));

      return NextResponse.json({
        ok: true,
        bets: formattedBets,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      });

    } catch (dbError) {
      console.error('[bets] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database query failed' 
      }, { status: 500 });
    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('[bets] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}