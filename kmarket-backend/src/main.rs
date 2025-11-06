use actix_cors::Cors;
use actix_governor::{Governor, GovernorConfigBuilder};
use actix_web::{
    get, http, middleware::Compress, middleware::Logger, web::Data, App, HttpServer, Responder,
};
use tracing::info;
use tracing_subscriber::EnvFilter;

mod config;
mod db;
mod errors;
mod models;
mod routes;
mod services;

#[derive(Clone)]
struct AppState {
    config: config::AppConfig,
    db_pool: Option<sqlx::PgPool>,
}

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
    let state = AppState {
        config: cfg.clone(),
        db_pool,
    };

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin_fn(|origin, _req_head| {
                // 示例：允许本地与指定域名，可按需扩展
                origin.as_bytes().starts_with(b"http://127.0.0.1")
                    || origin.as_bytes().starts_with(b"http://localhost")
                    || origin.as_bytes().starts_with(b"https://kmarket.com")
            })
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
            .allowed_headers(vec![
                http::header::CONTENT_TYPE,
                http::header::AUTHORIZATION,
            ])
            .supports_credentials();

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
            .configure(routes::configure)
    })
    .bind((cfg.bind_addr.clone(), cfg.bind_port))?
    .run()
    .await
}
