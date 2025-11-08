pub mod config;
pub mod cache;
pub mod db;
pub mod errors;
pub mod models;
pub mod routes;
pub mod services;
pub mod ws;

#[derive(Clone)]
pub struct AppState {
    pub config: config::AppConfig,
    pub db_pool: Option<sqlx::PgPool>,
    pub redis_client: Option<redis::Client>,
    pub ws_hub: Option<actix::Addr<ws::WsHub>>, // WebSocket 广播中心
}