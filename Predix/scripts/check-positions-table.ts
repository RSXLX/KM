import mysql from 'mysql2/promise';

// 解析 MySQL URL
function parseMysqlUrl(url: string) {
  const urlObj = new URL(url);
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 3306,
    user: urlObj.username,
    password: urlObj.password,
    database: urlObj.pathname.slice(1),
    ssl: false,
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
  };
}

async function checkPositionsTable() {
  console.log('🔍 Checking positions table structure...\n');

  try {
    // 获取数据库配置
    const mysqlUrl = process.env.MYSQL_URL;
    if (!mysqlUrl) {
      console.error('❌ MYSQL_URL environment variable not found');
      process.exit(1);
    }

    const config = parseMysqlUrl(mysqlUrl);
    console.log(`📊 Connecting to database: ${config.database} at ${config.host}:${config.port}`);

    const pool = await mysql.createPool(config);

    try {
      // 检查表结构
      console.log('\n📋 Positions table structure:');
      const [columns] = await pool.query('DESCRIBE positions');
      console.table(columns);

      // 检查是否有 wallet_address 列
      const hasWalletAddress = (columns as any[]).some(col => col.Field === 'wallet_address');
      console.log(`\n🔍 Has wallet_address column: ${hasWalletAddress ? '✅ YES' : '❌ NO'}`);

      if (!hasWalletAddress) {
        // 查找可能的替代列
        const possibleColumns = (columns as any[]).filter(col => 
          col.Field.toLowerCase().includes('wallet') || 
          col.Field.toLowerCase().includes('address') ||
          col.Field.toLowerCase().includes('user')
        );
        
        console.log('\n🔍 Possible alternative columns:');
        if (possibleColumns.length > 0) {
          console.table(possibleColumns);
        } else {
          console.log('No wallet/address/user related columns found');
        }
      }

      // 检查表中的数据样本
      console.log('\n📊 Sample data from positions table:');
      const [sampleData] = await pool.query('SELECT * FROM positions LIMIT 3');
      if ((sampleData as any[]).length > 0) {
        console.table(sampleData);
      } else {
        console.log('No data found in positions table');
      }

      // 检查用户表结构以了解关联关系
      console.log('\n👤 Users table structure:');
      const [userColumns] = await pool.query('DESCRIBE users');
      console.table(userColumns);

    } catch (error) {
      console.error('❌ Database query error:', error);
    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('❌ Connection error:', error);
    process.exit(1);
  }
}

checkPositionsTable();