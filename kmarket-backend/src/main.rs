use actix_cors::Cors;
use actix_governor::{Governor, GovernorConfigBuilder};
use actix_web::{
    get, http, http::header::{HeaderName, ORIGIN, CONTENT_TYPE, ACCEPT, AUTHORIZATION, CONTENT_ENCODING},
    middleware::Compress, middleware::Logger, web::Data, App, HttpServer, Responder,
};
use tracing::info;
use tracing_subscriber::EnvFilter;
use actix::Actor;

use kmarket_backend::{config, cache, db, routes, ws};

use kmarket_backend::AppState;

#[get("/")]
async fn hello() -> impl Responder {
    "Hello, KMarket!"
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // 初始化结构化日志（支持 RUST_LOG）
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cfg = config::AppConfig::load();
    info!(bind_addr = %cfg.bind_addr, bind_port = %cfg.bind_port, "Starting KMarket backend");

    let db_pool = db::init_pg_pool(&cfg).await;
    let redis_client = cache::init_redis(&cfg).await;
    // 初始化 WebSocket 广播中心
    let ws_hub = ws::WsHub::new(redis_client.clone()).start();
    let state = AppState {
        config: cfg.clone(),
        db_pool,
        redis_client,
        ws_hub: Some(ws_hub.clone()),
    };

    HttpServer::new(move || {
        let cors = Cors::default()
            // 明确允许本地开发域（含端口），并启用凭据（cookies/Authorization）
            .allowed_origin("http://localhost:3000")
            .allowed_origin("http://127.0.0.1:3000")
            .allowed_origin("http://localhost:3001")
            .allowed_origin("http://127.0.0.1:3001")
            .allowed_methods(vec!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                ORIGIN,
                CONTENT_TYPE,
                ACCEPT,
                AUTHORIZATION,
                HeaderName::from_static("access-control-request-method"),
                HeaderName::from_static("access-control-request-headers"),
            ])
            .expose_headers(vec![
                CONTENT_ENCODING,
                CONTENT_TYPE,
            ])
            .supports_credentials()
            .max_age(3600);

        let governor_cfg = GovernorConfigBuilder::default()
            .per_second(10)
            .burst_size(20)
            .finish()
            .expect("invalid governor config");

        App::new()
            .app_data(Data::new(state.clone()))
            .wrap(Logger::default())
            .wrap(Compress::default())
            .wrap(cors)
            .wrap(Governor::new(&governor_cfg))
            .service(hello)
            .service(ws::ws_odds)
            .configure(routes::configure)
    })
    .bind((cfg.bind_addr.clone(), cfg.bind_port))?
    .run()
    .await
}
