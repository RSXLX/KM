use actix_web::{test, web::Data, App};
use ethers::signers::{LocalWallet, Signer};
use rand::rngs::OsRng;
use serde_json::Value;

use kmarket_backend::{config::AppConfig, cache, db, routes, AppState};

fn env_or_skip(key: &str) -> Option<String> { std::env::var(key).ok() }

#[actix_rt::test]
async fn admin_odds_override_updates_cache_and_route() {
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

    // Create wallet and login
    let wallet = LocalWallet::new(&mut OsRng);
    let address = format!("{:?}", wallet.address());
    let nonce_req = test::TestRequest::get().uri(&format!("/api/v1/auth/nonce?address={}", address)).to_request();
    let nonce_resp = test::call_service(&app, nonce_req).await;
    assert!(nonce_resp.status().is_success());
    let nonce_json: Value = test::read_body_json(nonce_resp).await;
    let nonce = nonce_json.get("nonce").and_then(|v| v.as_str()).unwrap().to_string();

    let message = format!("Login to KMarket: nonce={}", nonce);
    let signature = wallet.sign_message(message.clone()).await.unwrap();
    let signature_hex = format!("0x{}", hex::encode(signature.to_vec()));
    let verify_req = test::TestRequest::post().uri("/api/v1/auth/verify-sig").set_json(serde_json::json!({"address": address, "message": message, "signature": signature_hex})).to_request();
    let verify_resp = test::call_service(&app, verify_req).await;
    assert!(verify_resp.status().is_success());
    let verify_json: Value = test::read_body_json(verify_resp).await;
    let token = verify_json.get("token").unwrap().as_str().unwrap().to_string();

    // Promote user to admin
    let pool = db::init_pg_pool(&AppConfig { database_url: env_or_skip("DATABASE_URL"), ..AppConfig::load() }).await.unwrap();
    sqlx::query("UPDATE users SET role='admin' WHERE wallet_address = $1").bind(&address).execute(&pool).await.unwrap();

    // Create market so override has a target
    let admin_req = test::TestRequest::post().uri("/api/v1/admin/markets").append_header((actix_web::http::header::AUTHORIZATION, format!("Bearer {}", token))).set_json(serde_json::json!({
        "league": "NBA",
        "home_team": "Lakers",
        "away_team": "Warriors",
        "start_time": 1730908800000i64
    })).to_request();
    let admin_resp = test::call_service(&app, admin_req).await;
    assert_eq!(admin_resp.status(), actix_web::http::StatusCode::CREATED);
    let admin_json: Value = test::read_body_json(admin_resp).await;
    let market_id = admin_json.get("id").unwrap().as_i64().unwrap();

    // Override odds
    let ovr_req = test::TestRequest::post().uri("/api/v1/admin/odds/override")
        .append_header((actix_web::http::header::AUTHORIZATION, format!("Bearer {}", token)))
        .set_json(serde_json::json!({
            "market_id": market_id,
            "payload": {
                "moneyline": { "home": 1.82, "away": 2.15 },
                "spread": { "line": -3.0, "home": 1.92, "away": 1.88 },
                "total": { "line": 219.5, "over": 1.90, "under": 1.90 }
            },
            "reason": "Manual adjustment"
        })).to_request();
    let ovr_resp = test::call_service(&app, ovr_req).await;
    assert_eq!(ovr_resp.status(), actix_web::http::StatusCode::CREATED);

    // Read odds route should reflect cache
    let odds_req = test::TestRequest::get().uri(&format!("/api/v1/odds/{}", market_id)).to_request();
    let odds_resp = test::call_service(&app, odds_req).await;
    assert!(odds_resp.status().is_success());
    let odds_json: Value = test::read_body_json(odds_resp).await;
    assert_eq!(odds_json.get("source").unwrap().as_str().unwrap(), "cache");
    assert_eq!(odds_json.get("moneyline").unwrap().get("home").unwrap().as_f64().unwrap(), 1.82);
}