use kmarket_backend::{repository::{market_repo::{MarketRepository, CreateMarketRequest}, order_repo::{OrderRepository, CreateOrderRequest}, user_repo::{UserRepository, CreateUserRequest}}};
#[path = "common/helpers.rs"]
mod helpers;

#[actix_rt::test]
async fn test_user_repo_create_and_find() {
    let Some(pool) = helpers::maybe_init_test_db().await else {
        eprintln!("skipping DB tests: cannot connect/migrate");
        return;
    };
    let repo = UserRepository::new(pool.clone());
    let created = repo.create(CreateUserRequest {
        address: "0xabc".into(),
        username: Some("tester".into()),
        email: Some("tester@example.com".into()),
        password_hash: None,
        salt: None,
        status: Some("active".into()),
    }).await.expect("create user");

    let found = repo.find_by_address("0xabc").await.expect("find").unwrap();
    assert_eq!(created.id, found.id);
    assert_eq!(found.username.as_deref(), Some("tester"));
}

#[actix_rt::test]
async fn test_market_repo_create_and_stats() {
    let Some(pool) = helpers::maybe_init_test_db().await else {
        eprintln!("skipping DB tests: cannot connect/migrate");
        return;
    };
    let mrepo = MarketRepository::new(pool.clone());
    let market = mrepo.create(CreateMarketRequest {
        market_id: 2001,
        title: "T1".into(),
        description: None,
        option_a: "A".into(),
        option_b: "B".into(),
        start_time: chrono::Utc::now(),
        end_time: chrono::Utc::now() + chrono::Duration::hours(1),
    }).await.expect("create market");

    let orepo = OrderRepository::new(pool.clone());
    let _o = orepo.create(CreateOrderRequest {
        order_id: 9001,
        user_id: 1,
        market_id: market.id,
        amount: 5.0,
        odds: 1.5,
        option: 0,
    }).await.expect("create order");

    let stats = mrepo.get_market_stats(market.id).await.expect("stats");
    assert_eq!(stats.bets_a, 1);
    assert_eq!(stats.total_orders, 1);
}

#[actix_rt::test]
async fn test_order_repo_version_conflict() {
    let Some(pool) = helpers::maybe_init_test_db().await else {
        eprintln!("skipping DB tests: cannot connect/migrate");
        return;
    };
    let mrepo = MarketRepository::new(pool.clone());
    let market = mrepo.create(CreateMarketRequest {
        market_id: 3001,
        title: "T2".into(),
        description: None,
        option_a: "A".into(),
        option_b: "B".into(),
        start_time: chrono::Utc::now(),
        end_time: chrono::Utc::now() + chrono::Duration::hours(1),
    }).await.expect("create market");

    let urepo = UserRepository::new(pool.clone());
    let user = urepo.create(CreateUserRequest {
        address: "0xdef".into(),
        username: None,
        email: None,
        password_hash: None,
        salt: None,
        status: Some("active".into()),
    }).await.expect("create user");

    let orepo = OrderRepository::new(pool.clone());
    let order = orepo.create(CreateOrderRequest {
        order_id: 9100,
        user_id: user.id,
        market_id: market.id,
        amount: 10.0,
        odds: 2.0,
        option: 1,
    }).await.expect("create order");

    // wrong expected version -> conflict
    use kmarket_backend::models::order::OrderStatus;
    use kmarket_backend::utils::errors::DataAccessError;

    let err = orepo.update_status_with_version(order.id, order.version + 1, OrderStatus::Cancelled)
        .await
        .err()
        .expect("should fail");
    match err {
        DataAccessError::ConcurrencyConflict(_) => {},
        _ => panic!("unexpected error"),
    }
}