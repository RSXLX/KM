use actix_web::{test, App};
use actix::Actor;
use kmarket_backend::{routes, ws, AppState, config};
use chrono::Utc;
use jsonwebtoken::{encode, Header, EncodingKey};
use kmarket_backend::routes::auth::Claims;

#[actix_rt::test]
async fn test_ws_token_and_health_and_updates() {
    // 构建状态（无DB/Redis）
    let cfg = config::AppConfig::load();
    let state = AppState { config: cfg.clone(), db_pool: None, redis_client: None, ws_hub: None };
    let hub = ws::WsHub::new(None).start();
    let state = AppState { ws_hub: Some(hub.clone()), ..state };

    let app = test::init_service(
        App::new()
            .app_data(actix_web::web::Data::new(state.clone()))
            .service(routes::ws_health::ws_health)
            .service(routes::ws_token::ws_token)
            .service(routes::odds_updates::odds_updates)
    ).await;

    // 测试 ws_health
    let req = test::TestRequest::get().uri("/api/ws/health").to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // 构建一个 token（直接走 ws_token 更复杂依赖 JWT_SECRET，这里手工构建）
    let secret = state.config.jwt_secret.clone().unwrap_or_else(|| "testsecret".into());
    let now = Utc::now();
    let claims = Claims { sub: 1, address: "".into(), iat: now.timestamp() as usize, exp: (now.timestamp() as usize)+600, iss: state.config.jwt_iss.clone(), aud: state.config.jwt_aud.clone(), jti: uuid::Uuid::new_v4().to_string(), roles: vec!["ws".into()] };
    let _token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes())).unwrap();

    // 注入两条更新并获取增量
    hub.do_send(ws::BroadcastOdds { market_id: 200, payload: serde_json::json!({"odds_update":{"home":1.3,"away":2.4}}) });
    hub.do_send(ws::BroadcastOdds { market_id: 200, payload: serde_json::json!({"odds_update":{"home":1.4,"away":2.5}}) });
    actix_rt::time::sleep(std::time::Duration::from_millis(30)).await;
    // 此测试未使用 /api/v1 作用域，odds_updates 路径为 "/markets/..."
    let req = test::TestRequest::get().uri("/markets/200/odds/updates?since_seq=0&limit=10").to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}