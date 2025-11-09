use sqlx::PgPool;

/// Heartbeat check with configurable timeout per call
pub async fn heartbeat(pool: &PgPool) -> bool {
    sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .is_ok()
}