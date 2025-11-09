use kmarket_backend::state::{apply_sslmode_to_url, compute_backoff_delays};
#[path = "common/helpers.rs"]
mod helpers;

#[actix_rt::test]
async fn test_sslmode_append() {
    let u1 = apply_sslmode_to_url("postgresql://host:5432/db");
    assert!(u1.contains("sslmode="));
    let u2 = apply_sslmode_to_url("postgresql://localhost:5432/db");
    assert!(u2.contains("sslmode=prefer"));
    let u3 = apply_sslmode_to_url("postgresql://host:5432/db?foo=bar");
    assert!(u3.contains("&sslmode="));
}

#[actix_rt::test]
async fn test_backoff_delays() {
    let d = compute_backoff_delays(5);
    assert_eq!(d.len(), 5);
    assert_eq!(d[0], 200);
    assert!(d[4] <= 5000);
}

#[actix_rt::test]
async fn test_heartbeat_if_db_available() {
    let Some(pool) = helpers::maybe_init_test_db().await else { return; };
    let ok = kmarket_backend::state::heartbeat(&pool).await;
    assert!(ok);
}