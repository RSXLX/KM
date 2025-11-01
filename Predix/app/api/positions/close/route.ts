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

// 处理平仓请求
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // 验证必需字段
    if (!data.position_id || !data.wallet_address || !data.transaction_signature) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing required fields: position_id, wallet_address, transaction_signature' 
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

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 幂等性：检查是否已有相同签名的 CLOSE 记录
      if (data.transaction_signature) {
        const [dupClose] = await conn.query(
          `SELECT id FROM positions WHERE position_type = 'CLOSE' AND transaction_signature = ? LIMIT 1`,
          [data.transaction_signature]
        );
        if ((dupClose as any[]).length > 0) {
          await conn.rollback();
          return NextResponse.json({ ok: true, close_id: (dupClose as any[])[0].id, message: 'Duplicate close, returning existing record' }, { status: 200 });
        }
      }

      // 找到原始 OPEN 持仓，校验钱包归属
      const [openRows] = await conn.query(
        `SELECT p.*, u.wallet_address FROM positions p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = ? AND p.position_type = 'OPEN' AND p.status = 1 FOR UPDATE`,
        [data.position_id]
      );
      if ((openRows as any[]).length === 0) {
        await conn.rollback();
        return NextResponse.json({ ok: false, error: 'Open position not found or already closed', code: 'OPEN_NOT_FOUND' }, { status: 404 });
      }
      const openPos = (openRows as any[])[0];
      if (openPos.wallet_address !== data.wallet_address) {
        await conn.rollback();
        return NextResponse.json({ ok: false, error: 'Wallet not owner of position', code: 'WALLET_MISMATCH' }, { status: 403 });
      }

      // 市场状态校验
      const [marketRows] = await conn.query(
        'SELECT id, state, status, end_date, close_time, odds_home_bps, odds_away_bps FROM markets WHERE id = ? FOR UPDATE',
        [openPos.market_id]
      );
      if ((marketRows as any[]).length === 0) {
        await conn.rollback();
        return NextResponse.json({ ok: false, error: 'Market not found', code: 'MARKET_NOT_FOUND' }, { status: 404 });
      }
      const market = (marketRows as any[])[0];
      const isOpen = ((market.state ?? market.status) === 1);
      const endTs = market.close_time ? new Date(market.close_time).getTime() : (market.end_date ? new Date(market.end_date).getTime() : undefined);
      const nowTs = Date.now();
      if (!isOpen || (endTs && nowTs >= endTs)) {
        // 允许在收盘时平仓，但需要根据文档执行结算逻辑
        // 这里不直接阻断，而是继续以最新赔率作为 close_price 处理
      }

      // 确定 close_price：优先 data.close_price，否则按选队的市场赔率回退
      const openPriceBps = openPos.selected_team === 1 ? (openPos.odds_home_bps ?? market.odds_home_bps) : (openPos.odds_away_bps ?? market.odds_away_bps);
      const fallbackCloseBps = openPos.selected_team === 1 ? market.odds_home_bps : market.odds_away_bps;
      const closePriceBps = data.close_price ?? fallbackCloseBps;
      if (!openPriceBps || !closePriceBps) {
        await conn.rollback();
        return NextResponse.json({ ok: false, error: 'Missing odds to compute PnL', code: 'MISSING_ODDS' }, { status: 400 });
      }

      // 计算 PnL 与费用
      const amount = Number(openPos.amount);
      const multiplier = Number(openPos.multiplier_bps || 10000) / 10000;
      const deltaBps = Number(closePriceBps) - Number(openPriceBps);
      const grossPnl = Math.round(amount * (deltaBps / 10000) * multiplier);
      const closeFee = Number(data.fee_paid ?? 0);
      const netPnl = grossPnl - closeFee;

      // 插入 CLOSE 记录
      const [closeRes] = await conn.query(
        `INSERT INTO positions (
           user_id, market_id, wallet_address, market_address,
           position_type, selected_team, amount, multiplier_bps,
           odds_home_bps, odds_away_bps, close_price_bps,
           payout_expected, pnl, fee_paid, status,
           transaction_signature, timestamp, ref_position_id
         ) VALUES (?, ?, ?, ?, 'CLOSE', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), ?)`,
        [
          openPos.user_id, openPos.market_id, openPos.wallet_address, openPos.market_address,
          openPos.selected_team, openPos.amount, openPos.multiplier_bps,
          openPos.odds_home_bps ?? null, openPos.odds_away_bps ?? null, closePriceBps,
          openPos.payout_expected ?? null, netPnl, closeFee, 1,
          data.transaction_signature ?? null, openPos.id
        ]
      );
      const closeId = (closeRes as any).insertId;

      // 更新原始 OPEN 状态
      await conn.query(
        `UPDATE positions SET status = 2 WHERE id = ?`,
        [openPos.id]
      );

      await conn.commit();
      return NextResponse.json({ ok: true, close_id: closeId, pnl: netPnl, message: 'Position closed' });
    } catch (err) {
      await conn.rollback();
      console.error('[positions/close] DB error:', err);
      return NextResponse.json({ ok: false, error: 'Database operation failed', code: 'DB_ERROR' }, { status: 500 });
    } finally {
      conn.release();
      await pool.end();
    }

      // 查找原始开仓记录（通过 users 关联 wallet）
      const [positionRows] = await pool.query(
        `SELECT p.*, m.state as market_state, m.status as market_status 
         FROM positions p 
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN markets m ON p.market_id = m.id
         WHERE p.id = ? AND u.wallet_address = ? AND p.position_type = 'OPEN'`,
        [data.position_id, data.wallet_address]
      );

      if ((positionRows as any[]).length === 0) {
        await pool.query('ROLLBACK');
        return NextResponse.json({ 
          ok: false, 
          error: 'Position not found or not owned by this wallet' 
        }, { status: 404 });
      }

      const position = (positionRows as any[])[0];

      // 检查持仓状态
      if (position.status !== 1) { // 1 = Placed
        await pool.query('ROLLBACK');
        return NextResponse.json({ 
          ok: false, 
          error: 'Position is not in a closable state' 
        }, { status: 400 });
      }

      // 检查市场状态
      if (position.market_state !== 1) { // 1 = Open
        await pool.query('ROLLBACK');
        return NextResponse.json({ 
          ok: false, 
          error: 'Market is not open for closing positions' 
        }, { status: 400 });
      }

      // 检查是否已经平仓
      const [existingCloseRows] = await pool.query(
        `SELECT id FROM positions 
         WHERE user_id = ? AND market_id = ? AND position_type = 'CLOSE' 
         AND nonce = ?`,
        [position.user_id, position.market_id, position.nonce]
      );

      if ((existingCloseRows as any[]).length > 0) {
        await pool.query('ROLLBACK');
        return NextResponse.json({ 
          ok: false, 
          error: 'Position already closed' 
        }, { status: 400 });
      }

      // 计算平仓盈亏（这里使用传入的数据，实际应该从链上事件获取）
      const closePnl = data.close_pnl || 0;
      const closeFee = data.close_fee || 0;
      const fallbackOdds = position.selected_team === 1 ? position.odds_home_bps : position.odds_away_bps;
      const closePrice = (data.close_price ?? fallbackOdds);

      // 创建平仓记录
      const [closeResult] = await pool.query(
        `INSERT INTO positions (
          user_id, market_id, wallet_address, market_address, bet_address,
          nonce, position_type, selected_team, amount, multiplier_bps,
          status, pnl, fee_paid, close_price, close_pnl,
          transaction_signature, timestamp, closed_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'CLOSE', ?, ?, ?, 6, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          position.user_id, position.market_id, position.wallet_address, 
          position.market_address, position.bet_address, position.nonce,
          position.selected_team, position.amount, position.multiplier_bps,
          closePnl, closeFee, closePrice, closePnl, data.transaction_signature
        ]
      );

      // 更新原始开仓记录状态
      await pool.query(
        `UPDATE positions 
         SET status = 6, closed_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [data.position_id]
      );

      // 提交事务
      await pool.query('COMMIT');

      const closePositionId = (closeResult as any).insertId;

      return NextResponse.json({ 
        ok: true, 
        close_position_id: closePositionId,
        original_position_id: data.position_id,
        close_pnl: closePnl,
        message: 'Position closed successfully' 
      });

    } catch (dbError) {
      await pool.query('ROLLBACK');
      console.error('[positions/close] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database operation failed' 
      }, { status: 500 });
    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('[positions/close] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 查询平仓记录
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('wallet_address');
    const positionId = url.searchParams.get('position_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    if (!walletAddress && !positionId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'wallet_address or position_id is required' 
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
      let whereConditions = ["p.position_type = 'CLOSE'"];
      let queryParams = [];

      if (walletAddress) {
        whereConditions.push('p.wallet_address = ?');
        queryParams.push(walletAddress);
      }

      if (positionId) {
        // 查找对应的开仓记录的 nonce，然后查找平仓记录
        const [openPositionRows] = await pool.query(
          'SELECT nonce, market_id FROM positions WHERE id = ? AND position_type = "OPEN"',
          [positionId]
        );

        if ((openPositionRows as any[]).length > 0) {
          const openPosition = (openPositionRows as any[])[0];
          whereConditions.push('p.nonce = ? AND p.market_id = ?');
          queryParams.push(openPosition.nonce, openPosition.market_id);
        } else {
          return NextResponse.json({ 
            ok: false, 
            error: 'Original position not found' 
          }, { status: 404 });
        }
      }

      const whereClause = 'WHERE ' + whereConditions.join(' AND ');

      // 查询总数
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM positions p ${whereClause}`,
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
          m.state as market_state,
          open_pos.id as original_position_id,
          open_pos.amount as original_amount,
          open_pos.payout_expected as original_payout_expected
        FROM positions p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN markets m ON p.market_id = m.id
        LEFT JOIN positions open_pos ON (
          open_pos.user_id = p.user_id AND 
          open_pos.market_id = p.market_id AND 
          open_pos.nonce = p.nonce AND 
          open_pos.position_type = 'OPEN'
        )
        ${whereClause}
        ORDER BY p.timestamp DESC
        LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      return NextResponse.json({
        ok: true,
        close_positions: rows,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      });

    } catch (dbError) {
      console.error('[positions/close] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database query failed' 
      }, { status: 500 });
    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('[positions/close] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}