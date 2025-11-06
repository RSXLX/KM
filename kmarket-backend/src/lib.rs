pub mod config;
pub mod db;
pub mod errors;
pub mod models;
pub mod routes;
pub mod services;

#[derive(Clone)]
pub struct AppState {
    pub config: config::AppConfig,
    pub db_pool: Option<sqlx::PgPool>,
}
