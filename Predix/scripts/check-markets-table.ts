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

async function checkMarketsTable() {
  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) {
    console.error('MYSQL_URL not found');
    process.exit(1);
  }

  const config = parseMysqlUrl(mysqlUrl);
  const pool = await mysql.createPool(config);

  try {
    console.log('=== MARKETS TABLE COLUMNS ===');
    const [columns] = await pool.query('DESCRIBE markets');
    (columns as any[]).forEach((col, index) => {
      console.log(`${index + 1}. ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'nullable' : 'not null'}`);
    });

    console.log('\n=== CHECKING FOR FIXTURE_ID ===');
    const hasFixtureId = (columns as any[]).some(col => col.Field === 'fixture_id');
    console.log(`fixture_id column exists: ${hasFixtureId}`);

    if (!hasFixtureId) {
      console.log('\n=== POSSIBLE ALTERNATIVES ===');
      const alternatives = (columns as any[]).filter(col => 
        col.Field.includes('id') || col.Field.includes('name') || col.Field.includes('title')
      );
      alternatives.forEach(col => {
        console.log(`- ${col.Field} (${col.Type})`);
      });
    }

    console.log('\n=== SAMPLE DATA ===');
    const [sampleData] = await pool.query('SELECT * FROM markets LIMIT 3');
    if ((sampleData as any[]).length > 0) {
      console.table(sampleData);
    } else {
      console.log('No data found in markets table');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkMarketsTable();