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

async function ensureColumns(pool, database, table, columns) {
  const [existing] = await pool.query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [database, table]
  );
  const existingSet = new Set(existing.map(r => r.COLUMN_NAME));
  for (const col of columns) {
    if (!existingSet.has(col.name)) {
      console.log(`[*] Adding column ${table}.${col.name}`);
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${col.definition}`);
    } else {
      console.log(`[=] Column exists ${table}.${col.name}`);
    }
  }
}

async function ensureIndex(pool, database, table, indexName, columns, unique=false) {
  const [idx] = await pool.query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [database, table, indexName]
  );
  if (idx.length === 0) {
    const uniq = unique ? 'UNIQUE ' : '';
    console.log(`[*] Creating ${uniq}index ${indexName} on ${table}(${columns.join(', ')})`);
    await pool.query(`CREATE ${uniq}INDEX ${indexName} ON ${table}(${columns.join(', ')})`);
  } else {
    console.log(`[=] Index exists ${table}.${indexName}`);
  }
}

async function hasDuplicateTxSignatures(pool, database) {
  const [rows] = await pool.query(
    `SELECT transaction_signature, COUNT(*) AS cnt
     FROM positions
     WHERE transaction_signature IS NOT NULL AND transaction_signature <> ''
     GROUP BY transaction_signature
     HAVING cnt > 1
     LIMIT 1`
  );
  return rows.length > 0;
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

    const db = config.database;

    // markets table expected columns (minimal to satisfy app)
    const marketColumns = [
      { name: 'market_id_seed', definition: 'market_id_seed VARBINARY(64) NULL' },
      { name: 'market_address', definition: 'market_address VARCHAR(64) NULL' },
      { name: 'home_code', definition: 'home_code BIGINT NULL' },
      { name: 'away_code', definition: 'away_code BIGINT NULL' },
      { name: 'home_name', definition: 'home_name VARCHAR(100) NULL' },
      { name: 'away_name', definition: 'away_name VARCHAR(100) NULL' },
      { name: 'start_time', definition: 'start_time DATETIME NULL' },
      { name: 'close_time', definition: 'close_time DATETIME NULL' },
      { name: 'state', definition: 'state INT NULL' },
      { name: 'result', definition: 'result INT NULL' },
      { name: 'odds_home_bps', definition: 'odds_home_bps INT NULL' },
      { name: 'odds_away_bps', definition: 'odds_away_bps INT NULL' },
      { name: 'max_exposure', definition: 'max_exposure BIGINT NULL' },
      { name: 'current_exposure', definition: 'current_exposure BIGINT NULL' },
      { name: 'total_volume', definition: 'total_volume BIGINT NULL' },
      { name: 'total_bets', definition: 'total_bets INT NULL' },
      { name: 'resolved_at', definition: 'resolved_at DATETIME NULL' },
    ];

    // positions table expected columns (minimal set)
    const positionColumns = [
      { name: 'wallet_address', definition: 'wallet_address VARCHAR(64) NULL' },
      { name: 'market_address', definition: 'market_address VARCHAR(64) NULL' },
      { name: 'bet_address', definition: 'bet_address VARCHAR(64) NULL' },
      { name: 'nonce', definition: 'nonce BIGINT NULL' },
      { name: 'position_type', definition: "position_type VARCHAR(10) NULL" },
      { name: 'selected_team', definition: 'selected_team INT NULL' },
      { name: 'amount', definition: 'amount BIGINT NULL' },
      { name: 'multiplier_bps', definition: 'multiplier_bps INT NULL' },
      { name: 'odds_home_bps', definition: 'odds_home_bps INT NULL' },
      { name: 'odds_away_bps', definition: 'odds_away_bps INT NULL' },
      { name: 'payout_expected', definition: 'payout_expected BIGINT NULL' },
      { name: 'status', definition: 'status INT NULL' },
      { name: 'is_claimed', definition: 'is_claimed TINYINT(1) NULL' },
      { name: 'pnl', definition: 'pnl BIGINT NULL' },
      { name: 'fee_paid', definition: 'fee_paid BIGINT NULL' },
      { name: 'close_price', definition: 'close_price BIGINT NULL' },
      { name: 'close_pnl', definition: 'close_pnl BIGINT NULL' },
      { name: 'timestamp', definition: 'timestamp DATETIME NULL' },
      { name: 'closed_at', definition: 'closed_at DATETIME NULL' },
      { name: 'transaction_signature', definition: 'transaction_signature VARCHAR(88) NULL' },
      { name: 'block_slot', definition: 'block_slot BIGINT NULL' },
      { name: 'confirmation_status', definition: "confirmation_status VARCHAR(20) NULL" },
    ];

    console.log('== Ensuring markets columns ==');
    await ensureColumns(pool, db, 'markets', marketColumns);

    console.log('== Ensuring positions columns ==');
    await ensureColumns(pool, db, 'positions', positionColumns);

    console.log('== Ensuring indexes ==');
    await ensureIndex(pool, db, 'markets', 'idx_markets_state', ['state']);
    await ensureIndex(pool, db, 'markets', 'idx_markets_start_time', ['start_time']);
    await ensureIndex(pool, db, 'markets', 'idx_markets_address', ['market_address']);

    // transaction_signature unique index if safe; else non-unique
    const dup = await hasDuplicateTxSignatures(pool, db);
    if (!dup) {
      await ensureIndex(pool, db, 'positions', 'uniq_positions_tx_sig', ['transaction_signature'], true);
    } else {
      console.warn('! Duplicate transaction_signature values exist; creating non-unique index instead');
      await ensureIndex(pool, db, 'positions', 'idx_positions_tx_sig', ['transaction_signature'], false);
    }

    await ensureIndex(pool, db, 'positions', 'idx_positions_wallet_address', ['wallet_address']);
    await ensureIndex(pool, db, 'positions', 'idx_positions_status', ['status']);
    await ensureIndex(pool, db, 'positions', 'idx_positions_timestamp', ['timestamp']);

    console.log('Migration completed.');
    await pool.end();
  } catch (err) {
    console.error('Migration error:', err);
    process.exitCode = 1;
  }
})();