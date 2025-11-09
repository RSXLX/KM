use kmarket_backend::repository::order_repo::{OrderRepository, CreateOrderRequest};
use kmarket_backend::repository::user_repo::{UserRepository, CreateUserRequest};
use kmarket_backend::repository::market_repo::{MarketRepository, CreateMarketRequest};
#[path = "common/helpers.rs"]
mod helpers;

#[actix_rt::test]
async fn test_create_order_with_audit_tx() {
    let Some(pool) = helpers::maybe_init_test_db().await else { return; };

    let urepo = UserRepository::new(pool.clone());
    let user = urepo.create(CreateUserRequest {
        address: "0xmock".into(), username: None, email: None, password_hash: None, salt: None, status: Some("active".into())
    }).await.unwrap();

    let mrepo = MarketRepository::new(pool.clone());
    let market = mrepo.create(CreateMarketRequest {
        market_id: 999001,
        title: "M".into(), description: None, option_a: "A".into(), option_b: "B".into(),
        start_time: chrono::Utc::now(), end_time: chrono::Utc::now() + chrono::Duration::hours(1)
    }).await.unwrap();

    let orepo = OrderRepository::new(pool.clone());
    let order = orepo.create_with_audit(CreateOrderRequest {
        order_id: 700001,
        user_id: user.id,
        market_id: market.id,
        amount: 1.0,
        odds: 2.0,
        option: 0,
    }).await.unwrap();

    let audit_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM order_audits WHERE order_id = $1")
        .bind(order.order_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(audit_count, 1);
}