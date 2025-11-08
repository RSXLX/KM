use actix_web::{test, web::Data, App};
use ethers::signers::{LocalWallet, Signer};
use ethers::types::H160;
use rand::rngs::OsRng;
use serde_json::Value;
use std::time::Instant;

use kmarket_backend::{config::AppConfig, cache, db, routes, AppState};

fn env_or_skip(key: &str) -> Option<String> { std::env::var(key).ok() }

#[actix_rt::test]
async fn auth_verify_sig_me_logout_contract() {
    // Skip if required envs are missing
    let (redis_url, db_url, jwt_secret) = match (env_or_skip("REDIS_URL"), env_or_skip("DATABASE_URL"), env_or_skip("JWT_SECRET")) {
        (Some(r), Some(d), Some(s)) => (r, d, s),
        _ => return,
    };

    let mut cfg = AppConfig::load();
    cfg.redis_url = Some(redis_url);
    cfg.database_url = Some(db_url);
    cfg.jwt_secret = Some(jwt_secret);
    cfg.skip_readyz_ping = true;

    let db_pool = db::init_pg_pool(&cfg).await;
    let redis_client = cache::init_redis(&cfg).await;
    let state = AppState { config: cfg, db_pool, redis_client, ws_hub: None };

    let app = test::init_service(App::new().app_data(Data::new(state)).configure(routes::configure)).await;

    // Create wallet
    let wallet = LocalWallet::new(&mut OsRng);
    let addr: H160 = wallet.address();
    let address = format!("{:?}", addr);

    // Get nonce
    let nonce_req = test::TestRequest::get().uri(&format!("/api/v1/auth/nonce?address={}", address)).to_request();
    let nonce_resp = test::call_service(&app, nonce_req).await;
    assert!(nonce_resp.status().is_success());
    let nonce_json: Value = test::read_body_json(nonce_resp).await;
    let nonce = nonce_json.get("nonce").and_then(|v| v.as_str()).unwrap().to_string();

    let message = format!("Login to KMarket: nonce={}", nonce);
    let signature = wallet.sign_message(message.clone()).await.unwrap();
    let signature_hex = format!("0x{}", hex::encode(signature.to_vec()));

    // Verify sig
    let verify_req = test::TestRequest::post().uri("/api/v1/auth/verify-sig").set_json(serde_json::json!({
        "address": address,
        "message": message,
        "signature": signature_hex,
    })).to_request();
    let verify_resp = test::call_service(&app, verify_req).await;
    assert!(verify_resp.status().is_success());
    let verify_json: Value = test::read_body_json(verify_resp).await;
    assert!(verify_json.get("token").and_then(|v| v.as_str()).is_some());
    assert_eq!(verify_json.get("user").unwrap().get("address").unwrap().as_str().unwrap(), address);
    let token = verify_json.get("token").unwrap().as_str().unwrap().to_string();

    // Me
    let me_req = test::TestRequest::get().uri("/api/v1/auth/me").append_header(("Authorization", format!("Bearer {}", token))).to_request();
    let me_resp = test::call_service(&app, me_req).await;
    assert!(me_resp.status().is_success());
    let me_json: Value = test::read_body_json(me_resp).await;
    assert_eq!(me_json.get("address").unwrap().as_str().unwrap(), address);

    // Logout
    let logout_req = test::TestRequest::post().uri("/api/v1/auth/logout").append_header(("Authorization", format!("Bearer {}", token))).to_request();
    let logout_resp = test::call_service(&app, logout_req).await;
    assert_eq!(logout_resp.status(), actix_web::http::StatusCode::NO_CONTENT);
}

#[actix_rt::test]
async fn auth_verify_sig_latency_baseline() {
    let (redis_url, db_url, jwt_secret) = match (env_or_skip("REDIS_URL"), env_or_skip("DATABASE_URL"), env_or_skip("JWT_SECRET")) {
        (Some(r), Some(d), Some(s)) => (r, d, s),
        _ => return,
    };

    let mut cfg = AppConfig::load();
    cfg.redis_url = Some(redis_url);
    cfg.database_url = Some(db_url);
    cfg.jwt_secret = Some(jwt_secret);
    cfg.skip_readyz_ping = true;

    let db_pool = db::init_pg_pool(&cfg).await;
    let redis_client = cache::init_redis(&cfg).await;
    let state = AppState { config: cfg, db_pool, redis_client, ws_hub: None };
    let app = test::init_service(App::new().app_data(Data::new(state)).configure(routes::configure)).await;

    let wallet = LocalWallet::new(&mut OsRng);
    let address = format!("{:?}", wallet.address());

    // perform 10 auth calls and measure
    let mut times = vec![];
    for _ in 0..10 {
        let nonce_req = test::TestRequest::get().uri(&format!("/api/v1/auth/nonce?address={}", address)).to_request();
        let nonce_resp = test::call_service(&app, nonce_req).await;
        let nonce_json: Value = test::read_body_json(nonce_resp).await;
        let nonce = nonce_json.get("nonce").and_then(|v| v.as_str()).unwrap().to_string();
        let message = format!("Login to KMarket: nonce={}", nonce);
        let signature = wallet.sign_message(message.clone()).await.unwrap();
        let signature_hex = format!("0x{}", hex::encode(signature.to_vec()));

        let start = Instant::now();
        let verify_req = test::TestRequest::post().uri("/api/v1/auth/verify-sig").set_json(serde_json::json!({
            "address": address,
            "message": message,
            "signature": signature_hex,
        })).to_request();
        let verify_resp = test::call_service(&app, verify_req).await;
        assert!(verify_resp.status().is_success());
        let elapsed = start.elapsed();
        times.push(elapsed);
    }

    times.sort();
    let median = times[times.len() / 2];
    // Basic assertion: median < 150ms in local env
    assert!(median.as_millis() < 150, "median={:?}", median);
}