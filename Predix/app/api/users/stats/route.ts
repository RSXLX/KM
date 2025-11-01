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

// 获取用户统计数据
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('wallet_address');

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
      // 获取用户基本信息
      const [userRows] = await pool.query(
        'SELECT * FROM users WHERE wallet_address = ?',
        [walletAddress]
      );

      if ((userRows as any[]).length === 0) {
        return NextResponse.json({ 
          ok: false, 
          error: 'User not found' 
        }, { status: 404 });
      }

      const user = (userRows as any[])[0];

      // 获取用户统计数据
      const [statsRows] = await pool.query(
        'SELECT * FROM user_stats WHERE user_id = ?',
        [user.id]
      );

      let stats = null;
      if ((statsRows as any[]).length > 0) {
        stats = (statsRows as any[])[0];
      }

      // 实时计算统计数据（如果统计表没有数据或需要更新）
      const [realTimeStats] = await pool.query(
        `SELECT 
          COUNT(CASE WHEN position_type = 'OPEN' THEN 1 END) as total_positions,
          SUM(CASE WHEN position_type = 'OPEN' THEN amount ELSE 0 END) as total_volume_lamports,
          COUNT(CASE WHEN position_type = 'OPEN' AND status = 1 THEN 1 END) as active_positions,
          COUNT(CASE WHEN position_type = 'CLOSE' THEN 1 END) as closed_positions,
          SUM(CASE WHEN position_type = 'CLOSE' THEN pnl ELSE 0 END) as total_pnl,
          SUM(CASE WHEN position_type = 'OPEN' OR position_type = 'CLOSE' THEN fee_paid ELSE 0 END) as total_fees_paid,
          COUNT(CASE WHEN position_type = 'OPEN' AND status = 2 THEN 1 END) as winning_positions,
          COUNT(CASE WHEN position_type = 'OPEN' AND status = 3 THEN 1 END) as losing_positions,
          AVG(CASE WHEN position_type = 'OPEN' THEN amount END) as avg_position_size,
          MAX(CASE WHEN position_type = 'OPEN' THEN amount END) as max_position_size,
          MIN(timestamp) as first_position_date,
          MAX(timestamp) as last_position_date
        FROM positions 
        WHERE wallet_address = ?`,
        [walletAddress]
      );

      const realTime = (realTimeStats as any[])[0];

      // 计算胜率
      const totalSettledPositions = (realTime.winning_positions || 0) + (realTime.losing_positions || 0);
      const winRate = totalSettledPositions > 0 ? 
        (realTime.winning_positions || 0) / totalSettledPositions : 0;

      // 获取最近的交易记录
      const [recentPositions] = await pool.query(
        `SELECT 
          p.*,
          m.home_name,
          m.away_name,
          m.start_time
        FROM positions p
        LEFT JOIN markets m ON p.market_id = m.id
        WHERE p.wallet_address = ?
        ORDER BY p.timestamp DESC
        LIMIT 10`,
        [walletAddress]
      );

      // 获取月度统计
      const [monthlyStats] = await pool.query(
        `SELECT 
          DATE_FORMAT(timestamp, '%Y-%m') as month,
          COUNT(CASE WHEN position_type = 'OPEN' THEN 1 END) as positions_count,
          SUM(CASE WHEN position_type = 'OPEN' THEN amount ELSE 0 END) as volume,
          SUM(CASE WHEN position_type = 'CLOSE' THEN pnl ELSE 0 END) as pnl
        FROM positions 
        WHERE wallet_address = ? 
        AND timestamp >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(timestamp, '%Y-%m')
        ORDER BY month DESC`,
        [walletAddress]
      );

      const response = {
        ok: true,
        user: {
          id: user.id,
          wallet_address: user.wallet_address,
          username: user.username,
          created_at: user.created_at
        },
        stats: {
          // 使用实时计算的数据
          total_positions: realTime.total_positions || 0,
          total_volume_lamports: realTime.total_volume_lamports || 0,
          total_volume_sol: (realTime.total_volume_lamports || 0) / 1e9,
          active_positions: realTime.active_positions || 0,
          closed_positions: realTime.closed_positions || 0,
          total_pnl: realTime.total_pnl || 0,
          total_pnl_sol: (realTime.total_pnl || 0) / 1e9,
          total_fees_paid: realTime.total_fees_paid || 0,
          total_fees_paid_sol: (realTime.total_fees_paid || 0) / 1e9,
          winning_positions: realTime.winning_positions || 0,
          losing_positions: realTime.losing_positions || 0,
          win_rate: winRate,
          avg_position_size: realTime.avg_position_size || 0,
          avg_position_size_sol: (realTime.avg_position_size || 0) / 1e9,
          max_position_size: realTime.max_position_size || 0,
          max_position_size_sol: (realTime.max_position_size || 0) / 1e9,
          first_position_date: realTime.first_position_date,
          last_position_date: realTime.last_position_date,
          updated_at: new Date()
        },
        recent_positions: recentPositions,
        monthly_stats: monthlyStats
      };

      return NextResponse.json(response);

    } catch (dbError) {
      console.error('[users/stats] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database query failed' 
      }, { status: 500 });
    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('[users/stats] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 更新用户统计数据（通常由后台任务调用）
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data.wallet_address) {
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
      // 获取用户ID
      const [userRows] = await pool.query(
        'SELECT id FROM users WHERE wallet_address = ?',
        [data.wallet_address]
      );

      if ((userRows as any[]).length === 0) {
        return NextResponse.json({ 
          ok: false, 
          error: 'User not found' 
        }, { status: 404 });
      }

      const userId = (userRows as any[])[0].id;

      // 重新计算统计数据
      const [statsData] = await pool.query(
        `SELECT 
          COUNT(CASE WHEN position_type = 'OPEN' THEN 1 END) as total_positions,
          SUM(CASE WHEN position_type = 'OPEN' THEN amount ELSE 0 END) as total_volume_lamports,
          COUNT(CASE WHEN position_type = 'OPEN' AND status = 1 THEN 1 END) as active_positions,
          COUNT(CASE WHEN position_type = 'CLOSE' THEN 1 END) as closed_positions,
          SUM(CASE WHEN position_type = 'CLOSE' THEN pnl ELSE 0 END) as total_pnl,
          SUM(CASE WHEN position_type = 'OPEN' OR position_type = 'CLOSE' THEN fee_paid ELSE 0 END) as total_fees_paid,
          COUNT(CASE WHEN position_type = 'OPEN' AND status = 2 THEN 1 END) as winning_positions,
          COUNT(CASE WHEN position_type = 'OPEN' AND status = 3 THEN 1 END) as losing_positions,
          AVG(CASE WHEN position_type = 'OPEN' THEN amount END) as avg_position_size,
          MAX(CASE WHEN position_type = 'OPEN' THEN amount END) as max_position_size
        FROM positions 
        WHERE user_id = ?`,
        [userId]
      );

      const stats = (statsData as any[])[0];
      const totalSettledPositions = (stats.winning_positions || 0) + (stats.losing_positions || 0);
      const winRate = totalSettledPositions > 0 ? 
        (stats.winning_positions || 0) / totalSettledPositions : 0;

      // 更新或插入统计数据
      await pool.query(
        `INSERT INTO user_stats (
          user_id, total_positions, total_volume_lamports, active_positions,
          closed_positions, total_pnl, total_fees_paid, winning_positions,
          losing_positions, win_rate, avg_position_size, max_position_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          total_positions = VALUES(total_positions),
          total_volume_lamports = VALUES(total_volume_lamports),
          active_positions = VALUES(active_positions),
          closed_positions = VALUES(closed_positions),
          total_pnl = VALUES(total_pnl),
          total_fees_paid = VALUES(total_fees_paid),
          winning_positions = VALUES(winning_positions),
          losing_positions = VALUES(losing_positions),
          win_rate = VALUES(win_rate),
          avg_position_size = VALUES(avg_position_size),
          max_position_size = VALUES(max_position_size),
          updated_at = NOW()`,
        [
          userId, stats.total_positions || 0, stats.total_volume_lamports || 0,
          stats.active_positions || 0, stats.closed_positions || 0, stats.total_pnl || 0,
          stats.total_fees_paid || 0, stats.winning_positions || 0, stats.losing_positions || 0,
          winRate, stats.avg_position_size || 0, stats.max_position_size || 0
        ]
      );

      return NextResponse.json({ 
        ok: true, 
        message: 'User statistics updated successfully' 
      });

    } catch (dbError) {
      console.error('[users/stats] Database error:', dbError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Database operation failed' 
      }, { status: 500 });
    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('[users/stats] API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}