const mysql = require('mysql2/promise');

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

async function ensureUniqueIndex(pool, table, indexName, columns) {
  const [rows] = await pool.query(
    'SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
    [table, indexName]
  );
  if (rows.length > 0) {
    console.log(`[constraints] Index already exists: ${indexName}`);
    return;
  }
  const cols = columns.map(c => `\`${c}\``).join(', ');
  const ddl = `ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${indexName}\` (${cols})`;
  console.log(`[constraints] Creating unique index: ${indexName} on ${table}(${columns.join(', ')})`);
  await pool.query(ddl);
}

(async () => {
  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) {
    console.error('[constraints] MYSQL_URL not configured');
    process.exit(1);
  }
  const config = parseMysqlUrl(mysqlUrl);
  const pool = await mysql.createPool(config);
  try {
    await ensureUniqueIndex(pool, 'positions', 'uniq_positions_tx_sig', ['transaction_signature']);
    console.log('[constraints] Completed');
  } catch (err) {
    console.error('[constraints] Error:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();