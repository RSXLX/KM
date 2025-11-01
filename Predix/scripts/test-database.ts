#!/usr/bin/env tsx
/**
 * 数据库连接测试脚本
 * 用于验证MySQL数据库连接配置和基本功能
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// 数据库配置
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'predix',
  ssl: process.env.DB_SSL === 'true' ? {} : undefined,
  connectTimeout: 10000,
  acquireTimeout: 10000,
  timeout: 10000,
};

// 如果有MYSQL_URL，优先使用它
const MYSQL_URL = process.env.MYSQL_URL;
if (MYSQL_URL) {
  // 解析MySQL URL: mysql://user:password@host:port/database
  const url = new URL(MYSQL_URL);
  DB_CONFIG.host = url.hostname;
  DB_CONFIG.port = parseInt(url.port) || 3306;
  DB_CONFIG.user = url.username;
  DB_CONFIG.password = url.password;
  DB_CONFIG.database = url.pathname.slice(1); // 移除开头的 /
}

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

class DatabaseTester {
  private results: TestResult[] = [];
  private connection: mysql.Connection | null = null;

  private log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
    const colors = {
      info: '\x1b[36m',    // cyan
      success: '\x1b[32m', // green
      error: '\x1b[31m',   // red
      warn: '\x1b[33m',    // yellow
    };
    const reset = '\x1b[0m';
    console.log(`${colors[type]}${message}${reset}`);
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration?: number) {
    this.results.push({ test, status, message, duration });
    const statusColor = status === 'PASS' ? 'success' : status === 'FAIL' ? 'error' : 'warn';
    const durationText = duration ? ` (${duration}ms)` : '';
    this.log(`[${status}] ${test}: ${message}${durationText}`, statusColor);
  }

  async testConnection(): Promise<void> {
    const startTime = Date.now();
    try {
      this.log('\n🔗 测试数据库连接...', 'info');
      this.log(`连接配置: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`, 'info');
      
      this.connection = await mysql.createConnection(DB_CONFIG);
      const duration = Date.now() - startTime;
      this.addResult('数据库连接', 'PASS', '连接成功', duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('数据库连接', 'FAIL', `连接失败: ${error}`, duration);
      throw error;
    }
  }

  async testBasicQuery(): Promise<void> {
    if (!this.connection) {
      this.addResult('基本查询', 'SKIP', '跳过：无数据库连接');
      return;
    }

    const startTime = Date.now();
    try {
      this.log('\n📊 测试基本查询...', 'info');
      const [rows] = await this.connection.execute('SELECT 1 as test_value, NOW() as server_time');
      const duration = Date.now() - startTime;
      this.addResult('基本查询', 'PASS', `查询成功，返回 ${Array.isArray(rows) ? rows.length : 0} 行`, duration);
      this.log(`  查询结果: ${JSON.stringify(rows)}`, 'info');
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('基本查询', 'FAIL', `查询失败: ${error}`, duration);
    }
  }

  async testDatabaseExists(): Promise<void> {
    if (!this.connection) {
      this.addResult('数据库存在性', 'SKIP', '跳过：无数据库连接');
      return;
    }

    const startTime = Date.now();
    try {
      this.log('\n🗄️ 检查数据库是否存在...', 'info');
      const [rows] = await this.connection.execute(
        'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
        [DB_CONFIG.database]
      );
      const duration = Date.now() - startTime;
      
      if (Array.isArray(rows) && rows.length > 0) {
        this.addResult('数据库存在性', 'PASS', `数据库 '${DB_CONFIG.database}' 存在`, duration);
      } else {
        this.addResult('数据库存在性', 'FAIL', `数据库 '${DB_CONFIG.database}' 不存在`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('数据库存在性', 'FAIL', `检查失败: ${error}`, duration);
    }
  }

  async testTablesExist(): Promise<void> {
    if (!this.connection) {
      this.addResult('表结构检查', 'SKIP', '跳过：无数据库连接');
      return;
    }

    const startTime = Date.now();
    try {
      this.log('\n📋 检查数据表是否存在...', 'info');
      
      const expectedTables = [
        'users',
        'markets', 
        'positions',
        'blockchain_events',
        'user_stats',
        'market_stats'
      ];

      const [rows] = await this.connection.execute(
        'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = "BASE TABLE"',
        [DB_CONFIG.database]
      );

      const existingTables = Array.isArray(rows) ? rows.map((row: any) => row.TABLE_NAME) : [];
      const missingTables = expectedTables.filter(table => !existingTables.includes(table));
      
      const duration = Date.now() - startTime;
      
      if (missingTables.length === 0) {
        this.addResult('表结构检查', 'PASS', `所有必需表都存在 (${existingTables.length}个表)`, duration);
        this.log(`  现有表: ${existingTables.join(', ')}`, 'info');
      } else {
        this.addResult('表结构检查', 'FAIL', `缺少表: ${missingTables.join(', ')}`, duration);
        this.log(`  现有表: ${existingTables.join(', ')}`, 'info');
        this.log(`  缺少表: ${missingTables.join(', ')}`, 'warn');
        
        // 尝试创建缺少的表
        await this.createMissingTables(missingTables);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('表结构检查', 'FAIL', `检查失败: ${error}`, duration);
    }
  }

  async createMissingTables(missingTables: string[]): Promise<void> {
    this.log('\n🔨 尝试创建缺少的表...', 'info');
    
    const tableSchemas = {
      users: `
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          wallet_address VARCHAR(42) UNIQUE NOT NULL,
          username VARCHAR(50),
          email VARCHAR(100),
          avatar_url TEXT,
          bio TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_wallet (wallet_address)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
      markets: `
        CREATE TABLE markets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          creator_id INT,
          category VARCHAR(50),
          end_date TIMESTAMP,
          resolution_date TIMESTAMP NULL,
          outcome ENUM('YES', 'NO', 'INVALID') NULL,
          total_volume DECIMAL(20,8) DEFAULT 0,
          liquidity DECIMAL(20,8) DEFAULT 0,
          yes_price DECIMAL(10,8) DEFAULT 0.5,
          no_price DECIMAL(10,8) DEFAULT 0.5,
          status ENUM('ACTIVE', 'RESOLVED', 'CANCELLED') DEFAULT 'ACTIVE',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (creator_id) REFERENCES users(id),
          INDEX idx_status (status),
          INDEX idx_category (category),
          INDEX idx_end_date (end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
      positions: `
        CREATE TABLE positions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          market_id INT NOT NULL,
          side ENUM('YES', 'NO') NOT NULL,
          shares DECIMAL(20,8) NOT NULL DEFAULT 0,
          avg_price DECIMAL(10,8) NOT NULL DEFAULT 0,
          total_cost DECIMAL(20,8) NOT NULL DEFAULT 0,
          realized_pnl DECIMAL(20,8) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (market_id) REFERENCES markets(id),
          UNIQUE KEY unique_position (user_id, market_id, side),
          INDEX idx_user_market (user_id, market_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
      blockchain_events: `
        CREATE TABLE blockchain_events (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tx_hash VARCHAR(66) UNIQUE NOT NULL,
          block_number BIGINT NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          contract_address VARCHAR(42) NOT NULL,
          user_address VARCHAR(42),
          market_id INT,
          event_data JSON,
          processed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_tx_hash (tx_hash),
          INDEX idx_block_number (block_number),
          INDEX idx_event_type (event_type),
          INDEX idx_processed (processed)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
      user_stats: `
        CREATE TABLE user_stats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT UNIQUE NOT NULL,
          total_volume DECIMAL(20,8) DEFAULT 0,
          total_pnl DECIMAL(20,8) DEFAULT 0,
          markets_created INT DEFAULT 0,
          markets_traded INT DEFAULT 0,
          win_rate DECIMAL(5,4) DEFAULT 0,
          total_trades INT DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          INDEX idx_total_volume (total_volume),
          INDEX idx_total_pnl (total_pnl)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
      market_stats: `
        CREATE TABLE market_stats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          market_id INT UNIQUE NOT NULL,
          total_volume DECIMAL(20,8) DEFAULT 0,
          total_trades INT DEFAULT 0,
          unique_traders INT DEFAULT 0,
          yes_volume DECIMAL(20,8) DEFAULT 0,
          no_volume DECIMAL(20,8) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (market_id) REFERENCES markets(id),
          INDEX idx_total_volume (total_volume),
          INDEX idx_total_trades (total_trades)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `
    };

    for (const tableName of missingTables) {
      if (tableSchemas[tableName as keyof typeof tableSchemas]) {
        try {
          await this.connection!.execute(tableSchemas[tableName as keyof typeof tableSchemas]);
          this.log(`  ✅ 成功创建表: ${tableName}`, 'success');
        } catch (error) {
          this.log(`  ❌ 创建表 ${tableName} 失败: ${error}`, 'error');
        }
      } else {
        this.log(`  ⚠️ 未找到表 ${tableName} 的创建脚本`, 'warn');
      }
    }
  }

  async testReadWriteOperations(): Promise<void> {
    if (!this.connection) {
      this.addResult('读写操作', 'SKIP', '跳过：无数据库连接');
      return;
    }

    const startTime = Date.now();
    try {
      this.log('\n✏️ 测试读写操作...', 'info');
      
      // 测试插入用户
      const testWallet = `test_wallet_${Date.now()}`;
      await this.connection.execute(
        'INSERT INTO users (wallet_address, username) VALUES (?, ?)',
        [testWallet, 'test_user']
      );

      // 测试查询
      const [rows] = await this.connection.execute(
        'SELECT id, wallet_address, username FROM users WHERE wallet_address = ?',
        [testWallet]
      );

      // 清理测试数据
      await this.connection.execute(
        'DELETE FROM users WHERE wallet_address = ?',
        [testWallet]
      );

      const duration = Date.now() - startTime;
      
      if (Array.isArray(rows) && rows.length > 0) {
        this.addResult('读写操作', 'PASS', '插入、查询、删除操作成功', duration);
      } else {
        this.addResult('读写操作', 'FAIL', '查询未返回预期数据', duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('读写操作', 'FAIL', `操作失败: ${error}`, duration);
      
      // 尝试清理可能残留的测试数据
      try {
        const testWallet = `test_wallet_${Date.now()}`;
        await this.connection.execute('DELETE FROM users WHERE wallet_address LIKE ?', ['test_wallet_%']);
      } catch (cleanupError) {
        this.log(`清理测试数据失败: ${cleanupError}`, 'warn');
      }
    }
  }

  async testConnectionPool(): Promise<void> {
    const startTime = Date.now();
    try {
      this.log('\n🏊 测试连接池...', 'info');
      
      const pool = mysql.createPool({
        ...DB_CONFIG,
        connectionLimit: 5,
        queueLimit: 0
      });

      // 并发测试多个连接
      const promises = Array.from({ length: 3 }, async (_, i) => {
        const [rows] = await pool.execute('SELECT ? as connection_id, NOW() as timestamp', [i + 1]);
        return rows;
      });

      const results = await Promise.all(promises);
      await pool.end();

      const duration = Date.now() - startTime;
      this.addResult('连接池', 'PASS', `成功处理 ${results.length} 个并发连接`, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('连接池', 'FAIL', `连接池测试失败: ${error}`, duration);
    }
  }

  async cleanup(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        this.log('\n🧹 数据库连接已关闭', 'info');
      } catch (error) {
        this.log(`关闭连接时出错: ${error}`, 'warn');
      }
    }
  }

  printSummary(): void {
    this.log('\n📊 测试结果汇总', 'info');
    this.log('='.repeat(50), 'info');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    
    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      const durationText = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${statusIcon} ${result.test}: ${result.message}${durationText}`);
    });
    
    this.log('\n📈 统计信息:', 'info');
    this.log(`  通过: ${passed}`, 'success');
    this.log(`  失败: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`  跳过: ${skipped}`, skipped > 0 ? 'warn' : 'info');
    this.log(`  总计: ${this.results.length}`, 'info');
    
    if (failed === 0) {
      this.log('\n🎉 所有测试通过！数据库连接正常。', 'success');
    } else {
      this.log('\n⚠️ 部分测试失败，请检查数据库配置。', 'error');
    }
  }

  async runAllTests(): Promise<void> {
    this.log('🚀 开始数据库连接测试...', 'info');
    this.log(`时间: ${new Date().toLocaleString()}`, 'info');
    
    try {
      await this.testConnection();
      await this.testBasicQuery();
      await this.testDatabaseExists();
      await this.testTablesExist();
      await this.testReadWriteOperations();
      await this.testConnectionPool();
    } catch (error) {
      this.log(`\n💥 测试过程中发生严重错误: ${error}`, 'error');
    } finally {
      await this.cleanup();
      this.printSummary();
    }
  }
}

// 主函数
async function main() {
  const tester = new DatabaseTester();
  await tester.runAllTests();
  
  // 退出码：有失败测试时返回1
  const hasFailures = tester['results'].some(r => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error('💥 测试脚本执行失败:', error);
    process.exit(1);
  });
}

export { DatabaseTester };