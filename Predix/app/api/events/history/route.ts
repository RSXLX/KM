import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// 数据库配置
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'predix',
  ssl: process.env.DB_SSL === 'true' ? {} : undefined,
};

// GET - 查询事件历史
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 查询参数
  const eventType = searchParams.get('event_type');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const hasError = searchParams.get('has_error');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  const pool = await mysql.createPool(DB_CONFIG);

  try {
    // 构建查询条件
    let whereConditions = [];
    let queryParams: any[] = [];

    if (eventType) {
      whereConditions.push('event_type = ?');
      queryParams.push(eventType);
    }

    if (startDate) {
      whereConditions.push('timestamp >= ?');
      queryParams.push(startDate);
    }

    if (endDate) {
      whereConditions.push('timestamp <= ?');
      queryParams.push(endDate);
    }

    if (hasError === 'true') {
      whereConditions.push('error_message IS NOT NULL');
    } else if (hasError === 'false') {
      whereConditions.push('error_message IS NULL');
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM blockchain_events 
      ${whereClause}
    `;

    const [countResult] = await pool.query(countQuery, queryParams);
    const total = (countResult as any[])[0].total;

    // 查询数据
    const dataQuery = `
      SELECT 
        id,
        event_type,
        transaction_signature,
        block_slot,
        timestamp,
        event_data,
        error_message,
        created_at
      FROM blockchain_events 
      ${whereClause}
      ORDER BY timestamp DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataQuery, [...queryParams, limit, offset]);

    // 处理数据
    const events = (rows as any[]).map(row => ({
      ...row,
      event_data: row.event_data ? JSON.parse(row.event_data) : null,
      has_error: !!row.error_message
    }));

    return NextResponse.json({
      success: true,
      data: {
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error querying event history:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to query event history'
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}

// POST - 重试失败的事件
export async function POST(request: NextRequest) {
  const { eventIds } = await request.json();

  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Invalid event IDs'
    }, { status: 400 });
  }

  const pool = await mysql.createPool(DB_CONFIG);

  try {
    // 查询失败的事件
    const placeholders = eventIds.map(() => '?').join(',');
    const query = `
      SELECT id, event_type, transaction_signature, event_data, error_message
      FROM blockchain_events 
      WHERE id IN (${placeholders}) AND error_message IS NOT NULL
    `;

    const [rows] = await pool.query(query, eventIds);
    const failedEvents = rows as any[];

    if (failedEvents.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No failed events found'
      }, { status: 404 });
    }

    const retryResults = [];

    // 重试每个失败的事件
    for (const event of failedEvents) {
      try {
        const eventData = JSON.parse(event.event_data);
        let success = false;

        // 根据事件类型调用相应的API
        switch (event.event_type) {
          case 'EventBetPlaced':
            success = await retryBetPlacedEvent(eventData, event.transaction_signature);
            break;
          case 'EventBetClosed':
            success = await retryBetClosedEvent(eventData, event.transaction_signature);
            break;
          case 'EventBetClaimed':
            success = await retryBetClaimedEvent(eventData, event.transaction_signature);
            break;
          case 'EventMarketResolved':
            success = await retryMarketResolvedEvent(eventData, event.transaction_signature);
            break;
          default:
            throw new Error(`Unknown event type: ${event.event_type}`);
        }

        if (success) {
          // 清除错误信息
          await pool.query(
            'UPDATE blockchain_events SET error_message = NULL WHERE id = ?',
            [event.id]
          );
        }

        retryResults.push({
          eventId: event.id,
          eventType: event.event_type,
          success,
          error: success ? null : 'Retry failed'
        });

      } catch (error) {
        retryResults.push({
          eventId: event.id,
          eventType: event.event_type,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = retryResults.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Retried ${failedEvents.length} events, ${successCount} succeeded`,
      data: {
        totalRetried: failedEvents.length,
        successCount,
        failedCount: failedEvents.length - successCount,
        results: retryResults
      }
    });

  } catch (error) {
    console.error('Error retrying failed events:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retry events'
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}

// 重试开仓事件
async function retryBetPlacedEvent(eventData: any, signature: string): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: eventData.user,
        market_address: eventData.market,
        selected_team: eventData.team,
        amount: eventData.amount,
        multiplier_bps: eventData.multiplierBps,
        odds_home_bps: eventData.team === 1 ? eventData.oddsBps : null,
        odds_away_bps: eventData.team === 2 ? eventData.oddsBps : null,
        transaction_signature: signature
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error retrying BetPlaced event:', error);
    return false;
  }
}

// 重试平仓事件
async function retryBetClosedEvent(eventData: any, signature: string): Promise<boolean> {
  try {
    // 首先查找对应的开仓记录
    const pool = await mysql.createPool(DB_CONFIG);
    const [positionRows] = await pool.query(
      'SELECT id FROM positions WHERE wallet_address = ? AND market_address = ? AND position_type = "OPEN" AND status = 1',
      [eventData.user, eventData.market]
    );
    await pool.end();

    if ((positionRows as any[]).length === 0) {
      return false;
    }

    const positionId = (positionRows as any[])[0].id;

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/positions/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position_id: positionId,
        wallet_address: eventData.user,
        close_price_bps: eventData.closePrice,
        close_pnl: eventData.pnl,
        transaction_signature: signature
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error retrying BetClosed event:', error);
    return false;
  }
}

// 重试兑付事件
async function retryBetClaimedEvent(eventData: any, signature: string): Promise<boolean> {
  try {
    const pool = await mysql.createPool(DB_CONFIG);
    await pool.query(
      `UPDATE positions 
       SET status = CASE WHEN ? > 0 THEN 2 ELSE 3 END, 
           pnl = ?, 
           is_claimed = true,
           updated_at = NOW()
       WHERE wallet_address = ? AND market_address = ? AND position_type = 'OPEN'`,
      [eventData.pnl, eventData.pnl, eventData.user, eventData.market]
    );
    await pool.end();

    return true;
  } catch (error) {
    console.error('Error retrying BetClaimed event:', error);
    return false;
  }
}

// 重试市场结算事件
async function retryMarketResolvedEvent(eventData: any, signature: string): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/markets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market_address: eventData.market,
        state: 3, // Resolved
        result: eventData.result,
        resolved_at: new Date().toISOString()
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error retrying MarketResolved event:', error);
    return false;
  }
}