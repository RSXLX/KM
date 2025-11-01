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
    connectionLimit: 10
  };
}

async function checkPositionsTable() {
  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) {
    console.error('MYSQL_URL not found');
    process.exit(1);
  }

  const config = parseMysqlUrl(mysqlUrl);
  const pool = await mysql.createPool(config);

  try {
    console.log('=== POSITIONS TABLE COLUMNS ===');
    const [columns] = await pool.query('DESCRIBE positions');
    (columns as any[]).forEach((col, index) => {
      console.log(`${index + 1}. ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'nullable' : 'not null'}`);
    });

    console.log('\n=== CHECKING FOR WALLET_ADDRESS ===');
    const hasWalletAddress = (columns as any[]).some(col => col.Field === 'wallet_address');
    console.log(`wallet_address column exists: ${hasWalletAddress}`);

    if (!hasWalletAddress) {
      console.log('\n=== POSSIBLE ALTERNATIVES ===');
      const alternatives = (columns as any[]).filter(col => 
        col.Field.includes('user') || col.Field.includes('wallet') || col.Field.includes('address')
      );
      alternatives.forEach(col => {
        console.log(`- ${col.Field} (${col.Type})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPositionsTable();