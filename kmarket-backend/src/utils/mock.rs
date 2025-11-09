use rand::{distributions::Alphanumeric, Rng};
use sqlx::PgPool;

pub fn random_address() -> String {
    // simple pseudo address
    let suffix: String = rand::thread_rng().sample_iter(&Alphanumeric).take(20).map(char::from).collect();
    format!("0x{}", suffix.to_lowercase())
}

pub async fn insert_mock_user(pool: &PgPool) -> Result<i64, sqlx::Error> {
    let addr = random_address();
    let rec = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO users (address, status) VALUES ($1, 'active') RETURNING id"#
    )
    .bind(addr)
    .fetch_one(pool)
    .await?;
    Ok(rec)
}

pub async fn insert_mock_market(pool: &PgPool) -> Result<i64, sqlx::Error> {
    let rec = sqlx::query_scalar::<_, i64>(
        r#"
        INSERT INTO markets (market_id, title, option_a, option_b, start_time, end_time, status)
        VALUES ((EXTRACT(EPOCH FROM NOW())*1000)::BIGINT, 'Mock', 'A', 'B', NOW(), NOW() + INTERVAL '1 hour', 'active')
        RETURNING id
        "#
    )
    .fetch_one(pool)
    .await?;
    Ok(rec)
}

pub async fn insert_mock_order(pool: &PgPool, user_id: i64, market_id: i64) -> Result<i64, sqlx::Error> {
    let rec = sqlx::query_scalar::<_, i64>(
        r#"
        INSERT INTO orders (order_id, user_id, market_id, amount, odds, option, status)
        VALUES ((EXTRACT(EPOCH FROM NOW())*1000)::BIGINT, $1, $2, 1.0, 1.5, 0, 'placed')
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind(market_id)
    .fetch_one(pool)
    .await?;
    Ok(rec)
}

pub async fn cleanup_all(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM order_audits;")
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM orders;")
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM markets;")
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM users;")
        .execute(pool)
        .await?;
    Ok(())
}