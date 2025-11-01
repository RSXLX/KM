import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

interface DatabaseHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    name?: string;
    tables?: string[];
    error?: string;
  };
  performance: {
    connectionTime?: number;
    queryTime?: number;
  };
}

// 数据库配置
function getDatabaseConfig() {
  // 优先使用 MYSQL_URL
  if (process.env.MYSQL_URL) {
    const url = new URL(process.env.MYSQL_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // 移除开头的 '/'
      ssl: url.searchParams.get('ssl') === 'true' ? { rejectUnauthorized: false } : false,
    };
  }

  // 回退到单独的环境变量
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ibet',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
}

export async function GET(request: NextRequest) {
  const response: DatabaseHealthResponse = {
    status: 'unhealthy',
    timestamp: new Date().toISOString(),
    database: {
      connected: false,
    },
    performance: {},
  };

  let connection: mysql.Connection | null = null;

  try {
    const config = getDatabaseConfig();
    
    // 测试数据库连接
    const connectionStart = Date.now();
    connection = await mysql.createConnection(config);
    response.performance.connectionTime = Date.now() - connectionStart;
    
    response.database.connected = true;
    response.database.name = config.database;

    // 测试基本查询
    const queryStart = Date.now();
    await connection.execute('SELECT 1');
    response.performance.queryTime = Date.now() - queryStart;

    // 获取表列表
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [config.database]);
    
    response.database.tables = (tables as any[]).map(row => row.TABLE_NAME);
    response.status = 'healthy';

  } catch (error) {
    response.database.error = error instanceof Error ? error.message : 'Unknown error';
    response.status = 'unhealthy';
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  // 根据健康状态返回相应的HTTP状态码
  const statusCode = response.status === 'healthy' ? 200 : 503;
  
  return NextResponse.json(response, { status: statusCode });
}

// 支持 POST 请求进行更详细的健康检查
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { includeTableInfo = false, testWrite = false } = body;

  const response: DatabaseHealthResponse & {
    detailed?: {
      tableCount?: number;
      writeTest?: boolean;
      connectionPool?: boolean;
    };
  } = {
    status: 'unhealthy',
    timestamp: new Date().toISOString(),
    database: {
      connected: false,
    },
    performance: {},
    detailed: {},
  };

  let connection: mysql.Connection | null = null;

  try {
    const config = getDatabaseConfig();
    
    // 测试数据库连接
    const connectionStart = Date.now();
    connection = await mysql.createConnection(config);
    response.performance.connectionTime = Date.now() - connectionStart;
    
    response.database.connected = true;
    response.database.name = config.database;

    // 测试基本查询
    const queryStart = Date.now();
    await connection.execute('SELECT 1');
    response.performance.queryTime = Date.now() - queryStart;

    // 获取表信息
    if (includeTableInfo) {
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
      `, [config.database]);
      
      response.database.tables = (tables as any[]).map(row => row.TABLE_NAME);
      response.detailed!.tableCount = (tables as any[]).length;
    }

    // 测试写操作
    if (testWrite) {
      try {
        const testId = `health_check_${Date.now()}`;
        await connection.execute(`
          CREATE TEMPORARY TABLE IF NOT EXISTS health_check_temp (
            id VARCHAR(50) PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await connection.execute('INSERT INTO health_check_temp (id) VALUES (?)', [testId]);
        await connection.execute('SELECT * FROM health_check_temp WHERE id = ?', [testId]);
        await connection.execute('DROP TEMPORARY TABLE health_check_temp');
        response.detailed!.writeTest = true;
      } catch (writeError) {
        response.detailed!.writeTest = false;
      }
    }

    // 测试连接池
    try {
      const pool = mysql.createPool({
        ...config,
        connectionLimit: 2,
        acquireTimeout: 1000,
      });
      
      const poolConnection = await pool.getConnection();
      await poolConnection.execute('SELECT 1');
      poolConnection.release();
      await pool.end();
      
      response.detailed!.connectionPool = true;
    } catch (poolError) {
      response.detailed!.connectionPool = false;
    }

    response.status = 'healthy';

  } catch (error) {
    response.database.error = error instanceof Error ? error.message : 'Unknown error';
    response.status = 'unhealthy';
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  const statusCode = response.status === 'healthy' ? 200 : 503;
  
  return NextResponse.json(response, { status: statusCode });
}