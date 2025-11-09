use kmarket_backend::repository::{user_repo::{UserRepository, CreateUserRequest}, market_repo::{MarketRepository, CreateMarketRequest}, order_repo::{OrderRepository, CreateOrderRequest}};
#[path = "common/helpers.rs"]
mod helpers;

#[actix_rt::test]
async fn test_crud_users_markets_orders() {
    let Some(pool) = helpers::maybe_init_test_db().await else { return; };

    // Create user
    let urepo = UserRepository::new(pool.clone());
    let user = urepo.create(CreateUserRequest {
        address: "0xcrud".into(), username: Some("crud".into()), email: Some("crud@example.com".into()), password_hash: None, salt: None, status: Some("active".into())
    }).await.unwrap();

    // Read user
    let fetched = urepo.find_by_address("0xcrud").await.unwrap().unwrap();
    assert_eq!(fetched.id, user.id);

    // Update user email with version
    let updated = urepo.update_email_with_version(user.id, user.version, "crud2@example.com").await.unwrap();
    assert_eq!(updated.email.as_deref(), Some("crud2@example.com"));

    // Create market
    let mrepo = MarketRepository::new(pool.clone());
    let market = mrepo.create(CreateMarketRequest {
        market_id: 880001, title: "CM".into(), description: None, option_a: "A".into(), option_b: "B".into(), start_time: chrono::Utc::now(), end_time: chrono::Utc::now() + chrono::Duration::hours(1)
    }).await.unwrap();

    // Create order
    let orepo = OrderRepository::new(pool.clone());
    let order = orepo.create_with_audit(CreateOrderRequest {
        order_id: 660001, user_id: user.id, market_id: market.id, amount: 2.5, odds: 1.8, option: 0
    }).await.unwrap();

    // Read order by id
    let fetched_order = orepo.find_by_order_id(order.order_id).await.unwrap().unwrap();
    assert_eq!(fetched_order.id, order.id);

    // Update order status
    let updated_order = orepo.update_status_with_version(order.id, order.version, kmarket_backend::models::order::OrderStatus::Cancelled).await.unwrap();
    assert!(matches!(updated_order.status, kmarket_backend::models::order::OrderStatus::Cancelled));

    // Delete order
    orepo.delete_by_id(order.id).await.unwrap();
    let after_del = orepo.find_by_order_id(order.order_id).await.unwrap();
    assert!(after_del.is_none());

    // Delete market
    mrepo.delete_by_id(market.id).await.unwrap();

    // Delete user
    urepo.delete_by_id(user.id).await.unwrap();
}