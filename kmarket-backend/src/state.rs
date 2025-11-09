use std::time::Duration;

use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// Global application state with database connection
#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
}

impl AppState {
    /// Initialize database pool reflecting required pool sizes and timeouts
    pub async fn new() -> Result<Self> {
        dotenv::dotenv().ok();
        let raw_url = std::env::var("DATABASE_URL")?;
        let url = apply_sslmode_to_url(&raw_url);

        let pool = connect_with_retry(&url, 5).await?;

        // Run migrations to ensure views/columns exist
        static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
        let _ = MIGRATOR.run(&pool).await;

    // Set per-session statement timeout for 60s according to spec
    sqlx::query("SET statement_timeout = 60000")
        .execute(&pool)
        .await?;

    // Align sequences in case seeds set fixed IDs
    align_sequences(&pool).await?;

    // Ensure positions view exists (defensive against migration cache)
    ensure_market_columns(&pool).await?;
    ensure_positions_view(&pool).await?;

        Ok(Self { db_pool: pool })
    }
}

/// Append appropriate sslmode to DSN. Default: require for non-localhost, prefer for localhost.
pub fn apply_sslmode_to_url(dsn: &str) -> String {
    let has_param = dsn.contains('?');
    let has_ssl = dsn.contains("sslmode=");
    if has_ssl { return dsn.to_string(); }

    let is_local = dsn.contains("localhost") || dsn.contains("127.0.0.1");
    let ssl = if is_local { "sslmode=prefer" } else { "sslmode=require" };
    if has_param { format!("{}&{}", dsn, ssl) } else { format!("{}?{}", dsn, ssl) }
}

/// Compute exponential backoff delays (ms) for retrying connects.
pub fn compute_backoff_delays(max_retries: u32) -> Vec<u64> {
    let mut delays = Vec::new();
    let mut base = 200u64; // 200ms
    for _ in 0..max_retries { delays.push(base); base = (base * 2).min(5_000); }
    delays
}

/// Connect with retry and backoff.
pub async fn connect_with_retry(url: &str, max_retries: u32) -> Result<PgPool> {
    let delays = compute_backoff_delays(max_retries);
    let mut last_err: Option<anyhow::Error> = None;
    for (i, delay) in delays.iter().enumerate() {
        match PgPoolOptions::new()
            .min_connections(5)
            .max_connections(20)
            .acquire_timeout(Duration::from_secs(30))
            .idle_timeout(Duration::from_secs(600))
            .connect(url)
            .await
        {
            Ok(pool) => return Ok(pool),
            Err(e) => {
                last_err = Some(anyhow::Error::from(e));
                tokio::time::sleep(Duration::from_millis(*delay)).await;
            }
        }
        if i == delays.len() - 1 { break; }
    }
    Err(last_err.unwrap_or_else(|| anyhow::anyhow!("connect failed")))
}

/// Heartbeat: returns true if `SELECT 1` succeeds.
pub async fn heartbeat(pool: &PgPool) -> bool {
    sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .is_ok()
}

async fn align_sequences(pool: &PgPool) -> Result<()> {
    sqlx::query("SELECT setval(pg_get_serial_sequence('users','id'), COALESCE((SELECT MAX(id) FROM users), 0) + 1, false)")
        .execute(pool).await?;
    sqlx::query("SELECT setval(pg_get_serial_sequence('markets','id'), COALESCE((SELECT MAX(id) FROM markets), 0) + 1, false)")
        .execute(pool).await?;
    sqlx::query("SELECT setval(pg_get_serial_sequence('orders','id'), COALESCE((SELECT MAX(id) FROM orders), 0) + 1, false)")
        .execute(pool).await?;
    sqlx::query("SELECT setval(pg_get_serial_sequence('order_audits','id'), COALESCE((SELECT MAX(id) FROM order_audits), 0) + 1, false)")
        .execute(pool).await?;
    Ok(())
}

async fn ensure_positions_view(pool: &PgPool) -> Result<()> {
    let exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pg_views WHERE viewname = 'positions_v'")
        .fetch_one(pool)
        .await?;
    if exists.0 == 0 {
        sqlx::query(
            r#"
            CREATE VIEW positions_v AS
            SELECT
                o.id AS id,
                o.user_id AS user_id,
                o.market_id AS market_id,
                u.address AS wallet_address,
                m.market_address AS market_address,
                NULL::TEXT AS bet_address,
                o.id AS nonce,
                'OPEN'::TEXT AS position_type,
                CASE WHEN o.option = 0 THEN 1 ELSE 2 END AS selected_team,
                o.amount::NUMERIC AS amount,
                ROUND(o.odds * 10000)::INT AS multiplier_bps,
                NULL::INT AS odds_home_bps,
                NULL::INT AS odds_away_bps,
                NULL::NUMERIC AS payout_expected,
                CASE o.status WHEN 'placed' THEN 1 WHEN 'cancelled' THEN 4 WHEN 'settled' THEN 2 ELSE 1 END AS status,
                FALSE AS is_claimed,
                0::NUMERIC AS pnl,
                0::NUMERIC AS fee_paid,
                NULL::NUMERIC AS close_price,
                NULL::NUMERIC AS close_pnl,
                o.created_at AS timestamp,
                o.created_at AS created_at,
                o.updated_at AS updated_at,
                NULL::TIMESTAMPTZ AS closed_at,
                NULL::TEXT AS transaction_signature,
                NULL::BIGINT AS block_slot,
                'pending'::TEXT AS confirmation_status
            FROM orders o
            JOIN users u ON u.id = o.user_id
            JOIN markets m ON m.id = o.market_id;
            "#
        )
        .execute(pool)
        .await?;
    }
    Ok(())
}

async fn ensure_market_columns(pool: &PgPool) -> Result<()> {
    // Defensive: add missing columns required by compat outputs
    let stmts = [
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS market_address VARCHAR(128)",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS home_code INT",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS away_code INT",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS home_name VARCHAR(128)",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS away_name VARCHAR(128)",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS close_time TIMESTAMPTZ",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS state INT DEFAULT 1",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS result INT DEFAULT 0",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS odds_home_bps INT",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS odds_away_bps INT",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS max_exposure NUMERIC(38,18) DEFAULT 0",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS current_exposure NUMERIC(38,18) DEFAULT 0",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS total_volume NUMERIC(38,18) DEFAULT 0",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS total_bets INT DEFAULT 0",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ",
    ];
    for s in stmts.iter() {
        let _ = sqlx::query(s).execute(pool).await;
    }
    // Initialize close_time from end_time if empty
    let _ = sqlx::query("UPDATE markets SET close_time = end_time WHERE close_time IS NULL AND end_time IS NOT NULL").execute(pool).await;
    Ok(())
}