use actix_web::{get, web, HttpResponse, Responder};

use crate::{
    errors::AppError,
    models::market::Market,
    services::market::{InMemoryMarketService, MarketService, PgMarketService},
    AppState,
};

#[get("/markets")]
pub async fn list_markets(state: web::Data<AppState>) -> Result<impl Responder, AppError> {
    // 根据是否存在数据库池选择实现
    let svc: Box<dyn MarketService> = match &state.db_pool {
        Some(pool) => Box::new(PgMarketService::new(pool.clone())),
        None => Box::new(InMemoryMarketService),
    };

    let markets: Vec<Market> = svc.list_markets().await.map_err(AppError::from)?;

    Ok(HttpResponse::Ok().json(markets))
}

#[get("/markets/{id}")]
pub async fn get_market(
    path: web::Path<i64>,
    state: web::Data<AppState>,
) -> Result<impl Responder, AppError> {
    let id = path.into_inner();
    let svc: Box<dyn MarketService> = match &state.db_pool {
        Some(pool) => Box::new(PgMarketService::new(pool.clone())),
        None => Box::new(InMemoryMarketService),
    };

    let market = svc.get_market(id).await.map_err(AppError::from)?;

    match market {
        Some(m) => Ok(HttpResponse::Ok().json(m)),
        None => Err(AppError::NotFound(format!("market {id} not found"))),
    }
}
