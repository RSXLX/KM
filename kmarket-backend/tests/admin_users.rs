use actix_web::{test, web, App};
use kmarket_backend::{routes, config::AppConfig};

#[actix_rt::test]
async fn test_list_admins_unauthorized() {
    let app_state = kmarket_backend::AppState { config: AppConfig::load(), db_pool: None, redis_client: None, ws_hub: None };
    let app = test::init_service(App::new().app_data(web::Data::new(app_state)).configure(routes::configure)).await;
    let req = test::TestRequest::get().uri("/api/v1/admins").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}