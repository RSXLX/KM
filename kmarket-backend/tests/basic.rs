use actix_web::{test, web::Data, App};
use serde_json::Value;

use kmarket_backend::{config::AppConfig, routes, AppState};

#[actix_rt::test]
async fn healthz_ok() {
    let cfg = AppConfig::load();
    let state = AppState {
        config: cfg,
        db_pool: None,
        redis_client: None,
        ws_hub: None,
    };

    let app = test::init_service(
        App::new()
            .app_data(Data::new(state))
            .configure(routes::configure),
    )
    .await;
    let req = test::TestRequest::get().uri("/api/v1/healthz").to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_rt::test]
async fn readyz_unavailable_when_missing_deps() {
    let cfg = AppConfig::load();
    let state = AppState {
        config: cfg,
        db_pool: None,
        redis_client: None,
        ws_hub: None,
    };

    let app = test::init_service(
        App::new()
            .app_data(Data::new(state))
            .configure(routes::configure),
    )
    .await;
    let req = test::TestRequest::get().uri("/api/v1/readyz").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.status(),
        actix_web::http::StatusCode::SERVICE_UNAVAILABLE
    );
}

#[actix_rt::test]
async fn readyz_ok_with_deps() {
    let mut cfg = AppConfig::load();
    cfg.database_url = Some("postgres://postgres:postgres@localhost:5432/kmarket".to_string());
    cfg.redis_url = Some("redis://127.0.0.1:6379".to_string());
    cfg.skip_readyz_ping = true;
    let state = AppState {
        config: cfg,
        db_pool: None,
        redis_client: None,
        ws_hub: None,
    };

    let app = test::init_service(
        App::new()
            .app_data(Data::new(state))
            .configure(routes::configure),
    )
    .await;
    let req = test::TestRequest::get().uri("/api/v1/readyz").to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_rt::test]
async fn markets_list_works_without_db() {
    let cfg = AppConfig::load();
    let state = AppState {
        config: cfg,
        db_pool: None,
        redis_client: None,
        ws_hub: None,
    };
    let app = test::init_service(
        App::new()
            .app_data(Data::new(state))
            .configure(routes::configure),
    )
    .await;

    let req = test::TestRequest::get().uri("/api/v1/markets").to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    let body: Value = test::read_body_json(resp).await;
    assert!(body.is_array());
    assert_eq!(body.as_array().unwrap().len(), 2);
}

#[actix_rt::test]
async fn market_get_found_and_not_found() {
    let cfg = AppConfig::load();
    let state = AppState {
        config: cfg,
        db_pool: None,
        redis_client: None,
        ws_hub: None,
    };
    let app = test::init_service(
        App::new()
            .app_data(Data::new(state))
            .configure(routes::configure),
    )
    .await;

    let req_found = test::TestRequest::get().uri("/api/v1/markets/1").to_request();
    let resp_found = test::call_service(&app, req_found).await;
    assert!(resp_found.status().is_success());

    let req_not = test::TestRequest::get().uri("/api/v1/markets/999").to_request();
    let resp_not = test::call_service(&app, req_not).await;
    assert_eq!(resp_not.status(), actix_web::http::StatusCode::NOT_FOUND);
}