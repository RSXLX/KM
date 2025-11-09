#[path = "common/helpers.rs"]
mod helpers;

#[actix_rt::test]
async fn test_index_usage_explain() {
    let Some(pool) = helpers::maybe_init_test_db().await else { return; };
    // Force planner to prefer indexes
    sqlx::query("SET enable_seqscan = off")
        .execute(&pool)
        .await
        .ok();

    // Ensure some rows exist
    let _ = sqlx::query("INSERT INTO markets (market_id, title, option_a, option_b, start_time, end_time, status) VALUES (12345, 'E', 'A','B', NOW(), NOW()+INTERVAL '1 hour', 'active')")
        .execute(&pool)
        .await;
    let mid: i64 = sqlx::query_scalar("SELECT id FROM markets WHERE market_id=12345")
        .fetch_one(&pool)
        .await
        .unwrap();
    let _ = sqlx::query("INSERT INTO users (address, status) VALUES ('0xidx', 'active')")
        .execute(&pool).await;
    let uid: i64 = sqlx::query_scalar("SELECT id FROM users WHERE address='0xidx'")
        .fetch_one(&pool)
        .await
        .unwrap();
    let _ = sqlx::query("INSERT INTO orders (order_id, user_id, market_id, amount, odds, option, status) VALUES (54321, $1, $2, 1.0, 1.5, 0, 'placed')")
        .bind(uid)
        .bind(mid)
        .execute(&pool)
        .await;

    let plan: String = sqlx::query_scalar("EXPLAIN SELECT * FROM orders WHERE market_id = $1")
        .bind(mid)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(plan.contains("Index") || plan.contains("Bitmap Index"));
}