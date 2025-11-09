use std::time::Duration;
use sqlx::{postgres::PgPoolOptions, PgPool};

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

pub async fn maybe_init_test_db() -> Option<PgPool> {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgre:55258864@localhost:5432/kmarket".to_string());

    let pool = PgPoolOptions::new()
        .min_connections(1)
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&db_url)
        .await
        .ok()?;

    if MIGRATOR.run(&pool).await.is_err() {
        return None;
    }
    Some(pool)
}