use actix_web::{test, web::Data, App};
use serde_json::Value;
use std::time::Instant;

use kmarket_backend::{config::AppConfig, cache, routes, AppState};

fn redis_url_from_env() -> Option<String> {
    std::env::var("REDIS_URL").ok()
}

fn database_url_from_env() -> Option<String> {
    std::env::var("DATABASE_URL").ok()
}

#[actix_rt::test]
async fn odds_cache_set_get_and_ttl() {
    let url = match redis_url_from_env() { Some(u) => u, None => return }; // skip when missing
    let client = redis::Client::open(url).unwrap();
    let mut conn = cache::store::get_conn(&client).await.unwrap();

    let market_id = 1001001_i64;
    let written = cache::store::set_odds(&mut conn, market_id, 185, 210).await.unwrap();
    assert_eq!(written.market_id, market_id);
    let got = cache::store::get_odds(&mut conn, market_id).await.unwrap().unwrap();
    assert_eq!(got.odds_a, 185);
    assert_eq!(got.odds_b, 210);

    // check TTL
    let key = format!("odds:{}", market_id);
    let ttl: i64 = redis::cmd("TTL").arg(&key).query_async(&mut conn).await.unwrap();
    assert!(ttl > 0 && ttl <= 60);
}

#[actix_rt::test]
async fn odds_atomic_last_write_wins() {
    let url = match redis_url_from_env() { Some(u) => u, None => return }; // skip when missing
    let client = redis::Client::open(url).unwrap();
    let mut conn = cache::store::get_conn(&client).await.unwrap();
    let market_id = 1001002_i64;

    let mut tasks = vec![];
    for i in 0..10 {
        let client2 = client.clone();
        tasks.push(tokio::spawn(async move {
            let mut c = cache::store::get_conn(&client2).await.unwrap();
            cache::store::set_odds(&mut c, market_id, 100 + i, 200 + i).await.unwrap();
        }));
    }
    for t in tasks { t.await.unwrap(); }

    let got = cache::store::get_odds(&mut conn, market_id).await.unwrap().unwrap();
    assert_eq!(got.odds_a, 109);
    assert_eq!(got.odds_b, 209);
}

#[actix_rt::test]
async fn odds_route_cache_hit_under_100ms() {
    let url = match redis_url_from_env() { Some(u) => u, None => return }; // skip when missing
    // Prepare app state with redis only
    let mut cfg = AppConfig::load();
    cfg.redis_url = Some(url);
    cfg.skip_readyz_ping = true;
    let client = cache::init_redis(&cfg).await.unwrap();
    let mut conn = cache::store::get_conn(&client).await.unwrap();
    // pre-populate cache
    cache::store::set_odds(&mut conn, 12345, 185, 210).await.unwrap();

    let state = AppState { config: cfg, db_pool: None, redis_client: Some(client), ws_hub: None };
    let app = test::init_service(App::new().app_data(Data::new(state)).configure(routes::configure)).await;

    let start = Instant::now();
    let req = test::TestRequest::get().uri("/api/v1/odds/12345").to_request();
    let resp = test::call_service(&app, req).await;
    let elapsed = start.elapsed();
    assert!(resp.status().is_success());
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["source"], "cache");
    assert!(elapsed.as_millis() < 100);
}

#[actix_rt::test]
async fn markets_active_cache_hit() {
    let url = match redis_url_from_env() { Some(u) => u, None => return }; // skip when missing
    // Prepare app state with redis only
    let mut cfg = AppConfig::load();
    cfg.redis_url = Some(url.clone());
    cfg.skip_readyz_ping = true;
    let client = cache::init_redis(&cfg).await.unwrap();
    let mut conn = cache::store::get_conn(&client).await.unwrap();

    // pre-populate snapshot
    let list = vec![
        cache::store::MarketSummary { market_id: 1001, title: "Game A".to_string(), category: "sports".to_string() },
        cache::store::MarketSummary { market_id: 1002, title: "Game B".to_string(), category: "sports".to_string() },
    ];
    cache::store::set_markets_active(&mut conn, &list).await.unwrap();

    let state = AppState { config: cfg, db_pool: None, redis_client: Some(client), ws_hub: None };
    let app = test::init_service(App::new().app_data(Data::new(state)).configure(routes::configure)).await;
    let req = test::TestRequest::get().uri("/api/v1/markets/active").to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["source"], "cache");
    assert_eq!(body["data"].as_array().unwrap().len(), 2);
}

#[actix_rt::test]
async fn session_create_requires_db() {
    let mut cfg = AppConfig::load();
    cfg.jwt_secret = Some("testsecret".to_string());
    let state = AppState { config: cfg, db_pool: None, redis_client: None, ws_hub: None };
    let app = test::init_service(App::new().app_data(Data::new(state)).configure(routes::configure)).await;
    let req = test::TestRequest::post().uri("/api/v1/session").set_json(serde_json::json!({"address":"0xabc","signature":"0xdead"})).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), actix_web::http::StatusCode::SERVICE_UNAVAILABLE);
}

#[actix_rt::test]
async fn session_me_reads_redis() {
    let url = match redis_url_from_env() { Some(u) => u, None => return }; // skip when missing
    let mut cfg = AppConfig::load();
    cfg.redis_url = Some(url.clone());
    cfg.skip_readyz_ping = true;
    let client = cache::init_redis(&cfg).await.unwrap();
    let mut conn = cache::store::get_conn(&client).await.unwrap();
    // write dummy session
    let token = "dummy-token";
    let sess = cache::store::SessionData { user_id: 1, address: "0xabc".to_string() };
    cache::store::create_session(&mut conn, token, &sess).await.unwrap();

    let state = AppState { config: cfg, db_pool: None, redis_client: Some(client), ws_hub: None };
    let app = test::init_service(App::new().app_data(Data::new(state)).configure(routes::configure)).await;
    let req = test::TestRequest::get().uri("/api/v1/session/me").insert_header((actix_web::http::header::AUTHORIZATION, format!("Bearer {}", token))).to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["userId"], 1);
    assert_eq!(body["address"], "0xabc");
}