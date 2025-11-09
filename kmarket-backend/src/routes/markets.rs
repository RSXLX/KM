use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use crate::state::AppState;
use crate::repository::market_repo::{MarketRepository, CreateMarketRequest};
use crate::utils::response::ApiResponse;

#[derive(Deserialize)]
pub struct GetMarketsQuery { pub page: Option<i64>, pub page_size: Option<i64> }

pub async fn get_markets(state: web::Data<AppState>, query: web::Query<GetMarketsQuery>) -> Result<HttpResponse> {
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    let repo = MarketRepository::new(state.db_pool.clone());
    let markets = repo.get_active_markets(page_size, offset).await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(markets)))
}

pub async fn get_market_detail(state: web::Data<AppState>, path: web::Path<i64>) -> Result<HttpResponse> {
    let market_id = path.into_inner();
    let repo = MarketRepository::new(state.db_pool.clone());
    let market = repo.find_by_market_id(market_id).await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?
        .ok_or_else(|| actix_web::error::ErrorNotFound("Market not found"))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(market)))
}

pub async fn get_market_stats(state: web::Data<AppState>, path: web::Path<i64>) -> Result<HttpResponse> {
    let market_id = path.into_inner();
    let repo = MarketRepository::new(state.db_pool.clone());
    let stats = repo.get_market_stats(market_id).await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(stats)))
}

#[derive(Deserialize)]
pub struct CreateMarketBody {
    pub market_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub option_a: String,
    pub option_b: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
}

pub async fn create_market(state: web::Data<AppState>, body: web::Json<CreateMarketBody>) -> Result<HttpResponse> {
    let repo = MarketRepository::new(state.db_pool.clone());
    let created = repo.create(CreateMarketRequest {
        market_id: body.market_id,
        title: body.title.clone(),
        description: body.description.clone(),
        option_a: body.option_a.clone(),
        option_b: body.option_b.clone(),
        start_time: body.start_time,
        end_time: body.end_time,
    }).await.map_err(|e| actix_web::error::ErrorBadRequest(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(created)))
}

#[derive(Deserialize)]
pub struct UpdateMarketStatusBody { pub expected_version: i32, pub status: String }

pub async fn update_market_status(state: web::Data<AppState>, path: web::Path<i64>, body: web::Json<UpdateMarketStatusBody>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let new_status = match body.status.as_str() {
        "pending" => crate::models::market::MarketStatus::Pending,
        "active" => crate::models::market::MarketStatus::Active,
        "settled" => crate::models::market::MarketStatus::Settled,
        "cancelled" => crate::models::market::MarketStatus::Cancelled,
        _ => return Ok(HttpResponse::BadRequest().json(ApiResponse::<()>::error("INVALID_STATUS", "Unknown status"))),
    };
    let repo = MarketRepository::new(state.db_pool.clone());
    let updated = repo.update_status_with_version(id, body.expected_version, new_status)
        .await
        .map_err(|e| actix_web::error::ErrorConflict(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(updated)))
}

pub async fn delete_market(state: web::Data<AppState>, path: web::Path<i64>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let repo = MarketRepository::new(state.db_pool.clone());
    repo.delete_by_id(id).await
        .map_err(|e| actix_web::error::ErrorNotFound(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"deleted": true, "id": id}))))
}