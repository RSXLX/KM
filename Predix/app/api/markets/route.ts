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
      // 检查市场是否已存在
      const [existingRows] = await pool.query(
        'SELECT id FROM markets WHERE market_address = ?',
        [data.market_address]
      );

      let marketId: number;

      if ((existingRows as any[]).length > 0) {
        // 更新现有市场
        marketId = (existingRows as any[])[0].id;
        await pool.query(
          `UPDATE markets SET 
            home_code = ?, away_code = ?, home_name = ?, away_name = ?,
            start_time = ?, close_time = ?, state = ?, result = ?,
            odds_home_bps = ?, odds_away_bps = ?, max_exposure = ?,
            current_exposure = ?, updated_at = NOW()
          WHERE market_address = ?`,
          [
            data.home_code, data.away_code, data.home_name || null, data.away_name || null,
            data.start_time, data.close_time, data.state || 1, data.result || 0,
            data.odds_home_bps, data.odds_away_bps, data.max_exposure,
            data.current_exposure || 0, data.market_address
          ]
        );
      } else {
        // 创建新市场
        const [result] = await pool.query(
          `INSERT INTO markets (
            market_id_seed, market_address, home_code, away_code,
            home_name, away_name, start_time, close_time, state, result,
            odds_home_bps, odds_away_bps, max_exposure, current_exposure
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.market_id_seed || Buffer.alloc(0), data.market_address,
            data.home_code, data.away_code, data.home_name || null, data.away_name || null,
            data.start_time, data.close_time, data.state || 1, data.result || 0,
            data.odds_home_bps, data.odds_away_bps, data.max_exposure, data.current_exposure || 0
          ]
        );
        marketId = (result as any).insertId;
      }

      return NextResponse.json({ 
        ok: true, 
        market_id: marketId,
        message: 'Market synchronized successfully' 
      });

    } catch (dbError) {
      console.error('[markets] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database operation failed' 
      }, { status: 500 });
    } finally {
      await pool.end();
    }

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
    const offset = (page - 1) * limit;

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

      if (marketAddress) {
        whereConditions.push('market_address = ?');
        queryParams.push(marketAddress);
      }

      if (state) {
        whereConditions.push('state = ?');
        queryParams.push(parseInt(state));
      }

      const whereClause = whereConditions.length > 0 ? 
        'WHERE ' + whereConditions.join(' AND ') : '';

      // 查询总数
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM markets ${whereClause}`,
        queryParams
      );
      const total = (countResult as any[])[0].total;

      // 查询数据（仅选择 markets 表现有列，移除不存在的 market_stats 字段）
      const [rows] = await pool.query(
        `SELECT 
          m.*
        FROM markets m
        ${whereClause}
        ORDER BY m.start_time DESC
        LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      return NextResponse.json({
        ok: true,
        markets: rows,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      });

    } catch (dbError) {
      console.error('[markets] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database query failed' 
      }, { status: 500 });
    } finally {
      await pool.end();
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
      // 构建更新字段
      let updateFields = [];
      let updateParams = [];

      if (data.state !== undefined) {
        updateFields.push('state = ?');
        updateParams.push(data.state);
      }

      if (data.result !== undefined) {
        updateFields.push('result = ?');
        updateParams.push(data.result);
      }

      if (data.current_exposure !== undefined) {
        updateFields.push('current_exposure = ?');
        updateParams.push(data.current_exposure);
      }

      if (data.odds_home_bps !== undefined) {
        updateFields.push('odds_home_bps = ?');
        updateParams.push(data.odds_home_bps);
      }

      if (data.odds_away_bps !== undefined) {
        updateFields.push('odds_away_bps = ?');
        updateParams.push(data.odds_away_bps);
      }

      if (data.resolved_at !== undefined) {
        updateFields.push('resolved_at = ?');
        updateParams.push(data.resolved_at);
      }

      if (updateFields.length === 0) {
        return NextResponse.json({ 
          ok: false, 
          error: 'No fields to update' 
        }, { status: 400 });
      }

      updateFields.push('updated_at = NOW()');
      updateParams.push(data.market_address);

      const [result] = await pool.query(
        `UPDATE markets SET ${updateFields.join(', ')} WHERE market_address = ?`,
        updateParams
      );

      if ((result as any).affectedRows === 0) {
        return NextResponse.json({ 
          ok: false, 
          error: 'Market not found' 
        }, { status: 404 });
      }

      return NextResponse.json({ 
        ok: true, 
        message: 'Market updated successfully' 
      });

    } catch (dbError) {
      console.error('[markets] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database operation failed' 
      }, { status: 500 });
    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('[markets] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}