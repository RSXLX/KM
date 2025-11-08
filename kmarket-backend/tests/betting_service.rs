use actix_rt as rt;
use kmarket_backend::{config::AppConfig, db};
use kmarket_backend::services::betting::{PgBettingService, PlaceOrder, ListOrdersQuery};

fn env_or_skip(key: &str) -> Option<String> { std::env::var(key).ok() }

#[rt::test]
async fn place_and_claim_happy_path_or_skip() {
    // Skip when DATABASE_URL not provided
    let Some(db_url) = env_or_skip("DATABASE_URL") else { return }; // skip

    let mut cfg = AppConfig::load();
    cfg.database_url = Some(db_url);
    let pool = db::init_pg_pool(&cfg).await.expect("pg pool");
    let svc = PgBettingService::new(pool.clone());

    // Prepare minimal market and option
    let market_id = 991001_i64;
    let _ = sqlx::query("DELETE FROM market_options WHERE market_id = $1").bind(market_id).execute(&pool).await.ok();
    let _ = sqlx::query("DELETE FROM markets WHERE market_id = $1").bind(market_id).execute(&pool).await.ok();
    let _m = kmarket_backend::db::repo::create_market(&pool, market_id, "T", "sports", None).await.unwrap();
    let _o1 = kmarket_backend::db::repo::create_market_option(&pool, market_id, 1, "Home", Some(185)).await.unwrap();
    let _o2 = kmarket_backend::db::repo::create_market_option(&pool, market_id, 2, "Away", Some(210)).await.unwrap();

    // Place order
    let order_id = chrono::Utc::now().timestamp_millis();
    let row = svc.place_order(PlaceOrder {

        order_id,
        user_address: "0xunit".into(),
        market_id,
        amount_text: "1000".into(),
        odds: 185,
        option: 1,
        potential_payout_text: None,
        tx_hash: Some("0xdead".into()),
    }).await.unwrap();
    assert_eq!(row.order_id, order_id);

    // List and fetch
    let list = svc.list_orders(ListOrdersQuery { user_address: Some("0xunit".into()), market_id: Some(market_id), settled: None, page: 1, page_size: 10 }).await.unwrap();
    assert!(list.iter().any(|r| r.order_id == order_id));

    // Insert a settlement to make it claimable
    sqlx::query("UPDATE orders SET settled=true, potential_payout='1850' WHERE order_id=$1").bind(order_id).execute(&pool).await.unwrap();
    let claim = svc.create_claim(order_id, "1850", "0xunit", None, "success").await.unwrap();
    assert_eq!(claim.order_id, order_id);
    svc.mark_claimed(order_id).await.unwrap();

    let got = svc.get_order_by_id(order_id).await.unwrap().unwrap();
    assert!(got.claimed);
}