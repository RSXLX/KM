use actix_web::{test, web::Data, App};
use serde_json::Value;

use kmarket_backend::{config::AppConfig, db, routes, AppState};

fn env_or_skip(key: &str) -> Option<String> { std::env::var(key).ok() }

#[actix_rt::test]
async fn create_bets_settle_and_claim_flow() {
    // Require DB configured; skip otherwise
    let (db_url, jwt_secret) = match (env_or_skip("DATABASE_URL"), env_or_skip("JWT_SECRET")) {
        (Some(d), Some(s)) => (d, s),
        _ => return,
    };

    let mut cfg = AppConfig::load();
    cfg.database_url = Some(db_url);
    cfg.jwt_secret = Some(jwt_secret);
    cfg.skip_readyz_ping = true;
    let db_pool = db::init_pg_pool(&cfg).await;
    let state = AppState { config: cfg, db_pool, redis_client: None, ws_hub: None };
    let app = test::init_service(App::new().app_data(Data::new(state)).configure(routes::configure)).await;

    // 预创建市场与选项（使用 admin 创建，需要 token；此处简化：直接 SQL 创建）
    // 创建 market
    let pool = kmarket_backend::db::init_pg_pool(&kmarket_backend::config::AppConfig::load()).await;
    let market_id = chrono::Utc::now().timestamp_millis();
    sqlx::query("INSERT INTO markets (market_id, title, category, status) VALUES ($1, 'Test Game', 'sports', 'active')")
        .bind(market_id).execute(pool.as_ref().unwrap()).await.unwrap();
    // 创建选项 1/2
    sqlx::query("INSERT INTO market_options (market_id, code, label) VALUES ($1, 1, 'home')")
        .bind(market_id).execute(pool.as_ref().unwrap()).await.unwrap();
    sqlx::query("INSERT INTO market_options (market_id, code, label) VALUES ($1, 2, 'away')")
        .bind(market_id).execute(pool.as_ref().unwrap()).await.unwrap();

    // 下两单：winner（option=1, odds=185）与 loser（option=2, odds=210）
    let req1 = test::TestRequest::post().uri("/api/v1/bets").set_json(serde_json::json!({
        "marketId": market_id,
        "option": 1,
        "amount": "1000",
        "odds": 185
    })).to_request();
    let resp1 = test::call_service(&app, req1).await;
    assert!(resp1.status().is_success());
    let o1: Value = test::read_body_json(resp1).await;
    let order_id_1 = o1.get("orderId").unwrap().as_i64().unwrap();

    let req2 = test::TestRequest::post().uri("/api/v1/bets").set_json(serde_json::json!({
        "marketId": market_id,
        "option": 2,
        "amount": "2000",
        "odds": 210
    })).to_request();
    let resp2 = test::call_service(&app, req2).await;
    assert!(resp2.status().is_success());
    let o2: Value = test::read_body_json(resp2).await;
    let order_id_2 = o2.get("orderId").unwrap().as_i64().unwrap();

    // 结算市场：胜方 option=1
    kmarket_backend::services::settlement::settle_market(&pool.as_ref().unwrap(), market_id, 1).await.unwrap();

    // 查询 winner：验证 settled 与 potentialPayout
    let get1 = test::TestRequest::get().uri(&format!("/api/v1/bets/{}", order_id_1)).to_request();
    let get1_resp = test::call_service(&app, get1).await;
    assert!(get1_resp.status().is_success());
    let g1: Value = test::read_body_json(get1_resp).await;
    assert_eq!(g1.get("settled").unwrap().as_bool().unwrap(), true);
    assert_eq!(g1.get("potentialPayout").unwrap().as_str().unwrap(), "1850");

    // loser 潜在收益=0
    let get2 = test::TestRequest::get().uri(&format!("/api/v1/bets/{}", order_id_2)).to_request();
    let get2_resp = test::call_service(&app, get2).await;
    assert!(get2_resp.status().is_success());
    let g2: Value = test::read_body_json(get2_resp).await;
    assert_eq!(g2.get("settled").unwrap().as_bool().unwrap(), true);
    assert_eq!(g2.get("potentialPayout").unwrap().as_str().unwrap(), "0");

    // 领取 winner
    let claim = test::TestRequest::post().uri(&format!("/api/v1/bets/{}/claim", order_id_1)).to_request();
    let claim_resp = test::call_service(&app, claim).await;
    assert!(claim_resp.status().is_success());
    let c1: Value = test::read_body_json(claim_resp).await;
    assert_eq!(c1.get("claimed").unwrap().as_bool().unwrap(), true);
    assert_eq!(c1.get("claimAmount").unwrap().as_str().unwrap(), "1850");
}