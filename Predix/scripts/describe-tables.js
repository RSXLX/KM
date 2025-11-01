const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

function parseMysqlUrl(url) {
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
    connectionLimit: 5,
  };
}

(async () => {
  try {
    const mysqlUrl = process.env.MYSQL_URL;
    if (!mysqlUrl) {
      console.error('MYSQL_URL not found in .env.local');
      process.exit(1);
    }
    const config = parseMysqlUrl(mysqlUrl);
    const pool = await mysql.createPool(config);

    const desc = async (table) => {
      const [cols] = await pool.query('DESCRIBE ' + table);
      console.log('=== ' + table + ' columns ===');
      console.log((cols).map(c => c.Field).join(', '));
    };

    await desc('markets');
    await desc('positions');
    await desc('market_stats');

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  }
})();