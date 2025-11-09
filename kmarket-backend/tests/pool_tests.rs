#[path = "common/helpers.rs"]
mod helpers;

#[actix_rt::test]
async fn test_pool_many_concurrent_queries() {
    let Some(pool) = helpers::maybe_init_test_db().await else { return; };
    let n = 32usize;
    let mut tasks = Vec::new();
    for _ in 0..n {
        let p = pool.clone();
        tasks.push(tokio::spawn(async move {
            sqlx::query("SELECT pg_sleep(0.01)").execute(&p).await.is_ok()
        }));
    }
    let mut ok_count = 0;
    for t in tasks { if t.await.unwrap_or(false) { ok_count += 1; } }
    assert_eq!(ok_count, n);
}