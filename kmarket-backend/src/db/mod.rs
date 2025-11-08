use sqlx::{postgres::PgPoolOptions, PgPool};
use tracing::{info, warn};

use crate::config::AppConfig;

/// 初始化 Postgres 连接池（若未配置 DATABASE_URL 则返回 None）
pub async fn init_pg_pool(cfg: &AppConfig) -> Option<PgPool> {
    let Some(db_url) = cfg.database_url.as_ref() else {
        warn!("DATABASE_URL not set; skipping DB pool initialization");
        return None;
    };

    match PgPoolOptions::new()
        .max_connections(5)
        .connect(db_url)
        .await
    {
        Ok(pool) => {
            info!("PostgreSQL pool connected");
            Some(pool)
        }
        Err(err) => {
            warn!(error = %err, "Failed to connect PostgreSQL; continue without DB");
            None
        }
    }
}

pub mod repo;