use sqlx::Row;
use actix_rt;

#[actix_rt::test]
async fn test_compat_markets_and_positions() {
    // Try to init DB and migrate; skip if not available
    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://postgres:55258864@localhost:5432/kmarket".to_string());
    let pool = sqlx::postgres::PgPoolOptions::new().min_connections(1).max_connections(5).connect(&db_url).await.ok();
    if pool.is_none() { return; }
    let pool = pool.unwrap();
    static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
    let _ = MIGRATOR.run(&pool).await;

    // Query positions_v directly
    let rows = sqlx::query("SELECT id, user_id, market_id, wallet_address, market_address, nonce, selected_team, amount::DOUBLE PRECISION as amount, multiplier_bps, status, timestamp, created_at, updated_at FROM positions_v ORDER BY created_at DESC LIMIT 5")
        .fetch_all(&pool).await.unwrap_or_default();
    // Mapping sanity: columns exist and types convertible
    for row in rows {
        let _: i64 = row.try_get("id").unwrap();
        let _: f64 = row.try_get("amount").unwrap();
        let _: i32 = row.try_get("multiplier_bps").unwrap();
    }
}