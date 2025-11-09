use kmarket_backend::utils::mock::{insert_mock_user, insert_mock_market, insert_mock_order, cleanup_all};
#[path = "common/helpers.rs"]
mod helpers;

#[actix_rt::test]
async fn test_mock_generate_and_cleanup() {
    let Some(pool) = helpers::maybe_init_test_db().await else { return; };
    let before: (i64, i64, i64) = sqlx::query_as("SELECT (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM markets), (SELECT COUNT(*) FROM orders)")
        .fetch_one(&pool)
        .await
        .unwrap();

    let uid = insert_mock_user(&pool).await.unwrap();
    let mid = insert_mock_market(&pool).await.unwrap();
    let _oid = insert_mock_order(&pool, uid, mid).await.unwrap();

    let after_insert: (i64, i64, i64) = sqlx::query_as("SELECT (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM markets), (SELECT COUNT(*) FROM orders)")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(after_insert.0 >= before.0 + 1);
    assert!(after_insert.1 >= before.1 + 1);
    assert!(after_insert.2 >= before.2 + 1);

    cleanup_all(&pool).await.unwrap();
    let after_cleanup: (i64, i64, i64) = sqlx::query_as("SELECT (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM markets), (SELECT COUNT(*) FROM orders)")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(after_cleanup.0, 0);
    assert_eq!(after_cleanup.1, 0);
    assert_eq!(after_cleanup.2, 0);
}