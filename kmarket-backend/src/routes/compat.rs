use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use sqlx::Row;

use crate::state::AppState;
use crate::utils::{response::ApiResponse};
use crate::repository::{order_repo::OrderRepository, user_repo::UserRepository};
use crate::models::order::OrderStatus;
use crate::models::dto::{FrontendMarket, FrontendPosition};

#[derive(Deserialize)]
pub struct GetMarketsQuery { pub page: Option<i64>, pub page_size: Option<i64> }

pub async fn get_frontend_markets(state: web::Data<AppState>, query: web::Query<GetMarketsQuery>) -> Result<HttpResponse> {
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;
    // Query markets with frontend-aligned columns
    let rows = sqlx::query(
        r#"
        SELECT
            id,
            NULL::TEXT AS market_id_seed,
            market_address,
            home_code, away_code, home_name, away_name,
            start_time, close_time, state, result,
            odds_home_bps, odds_away_bps,
            COALESCE(max_exposure, 0)::DOUBLE PRECISION AS max_exposure,
            COALESCE(current_exposure, 0)::DOUBLE PRECISION AS current_exposure,
            COALESCE(total_volume, 0)::DOUBLE PRECISION AS total_volume,
            COALESCE(total_bets, 0) AS total_bets,
            created_at, updated_at, resolved_at
        FROM markets
        WHERE (state = 1 OR state IS NULL) AND (close_time IS NULL OR close_time > NOW())
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#
    )
    .bind(page_size)
    .bind(offset)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let markets: Vec<FrontendMarket> = rows.into_iter().map(|row| FrontendMarket {
        id: row.try_get("id").unwrap_or(0),
        market_id_seed: None,
        market_address: row.try_get::<Option<String>, _>("market_address").unwrap_or(None),
        home_code: row.try_get::<Option<i32>, _>("home_code").unwrap_or(None),
        away_code: row.try_get::<Option<i32>, _>("away_code").unwrap_or(None),
        home_name: row.try_get::<Option<String>, _>("home_name").unwrap_or(None),
        away_name: row.try_get::<Option<String>, _>("away_name").unwrap_or(None),
        start_time: row.try_get("start_time").unwrap(),
        close_time: row.try_get::<Option<_>, _>("close_time").unwrap_or(None),
        state: row.try_get("state").unwrap_or(1),
        result: row.try_get("result").unwrap_or(0),
        odds_home_bps: row.try_get::<Option<i32>, _>("odds_home_bps").unwrap_or(None),
        odds_away_bps: row.try_get::<Option<i32>, _>("odds_away_bps").unwrap_or(None),
        max_exposure: row.try_get("max_exposure").unwrap_or(0.0),
        current_exposure: row.try_get("current_exposure").unwrap_or(0.0),
        total_volume: row.try_get("total_volume").unwrap_or(0.0),
        total_bets: row.try_get("total_bets").unwrap_or(0),
        created_at: row.try_get("created_at").unwrap(),
        updated_at: row.try_get("updated_at").unwrap(),
        resolved_at: row.try_get::<Option<_>, _>("resolved_at").unwrap_or(None),
    }).collect();

    Ok(HttpResponse::Ok().json(ApiResponse::success(markets)))
}

#[derive(Deserialize)]
pub struct AddressPath { pub address: String }

pub async fn get_frontend_positions(state: web::Data<AppState>, path: web::Path<AddressPath>) -> Result<HttpResponse> {
    // Query positions_v
    let rows = sqlx::query(
        r#"
        SELECT id, user_id, market_id, wallet_address, market_address, nonce,
               selected_team, amount::DOUBLE PRECISION as amount, multiplier_bps, status,
               timestamp, created_at, updated_at
        FROM positions_v
        WHERE wallet_address = $1
        ORDER BY created_at DESC
        "#
    )
    .bind(&path.address)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let positions: Vec<FrontendPosition> = rows.iter().map(|row| {
        crate::utils::mappers::map_position_row_to_frontend(
            row.try_get("id").unwrap_or(0),
            row.try_get("user_id").unwrap_or(0),
            row.try_get("market_id").unwrap_or(0),
            row.try_get::<String, _>("wallet_address").unwrap_or_default(),
            row.try_get::<Option<String>, _>("market_address").unwrap_or(None),
            row.try_get("nonce").unwrap_or(0),
            row.try_get("selected_team").unwrap_or(1),
            row.try_get("amount").unwrap_or(0.0),
            row.try_get("multiplier_bps").unwrap_or(0),
            row.try_get("status").unwrap_or(1),
            row.try_get("timestamp").unwrap(),
            row.try_get("created_at").unwrap(),
            row.try_get("updated_at").unwrap(),
        )
    }).collect();

    Ok(HttpResponse::Ok().json(ApiResponse::success(positions)))
}

#[derive(Deserialize)]
pub struct CreateFrontendPositionRequest {
    pub wallet_address: String,
    pub market_address: Option<String>,
    pub selected_team: i32,
    pub amount: f64,
    pub multiplier_bps: i32,
    pub odds_home_bps: Option<i32>,
    pub odds_away_bps: Option<i32>,
    pub transaction_signature: Option<String>,
}

pub async fn create_frontend_position(state: web::Data<AppState>, body: web::Json<CreateFrontendPositionRequest>) -> Result<HttpResponse> {
    let req = body.into_inner();
    if req.wallet_address.trim().is_empty() || req.amount <= 0.0 || (req.selected_team != 1 && req.selected_team != 2) {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()>::error("INVALID_ARGS", "Missing or invalid fields")));
    }
    let user_repo = UserRepository::new(state.db_pool.clone());
    let user = match user_repo.find_by_address(&req.wallet_address).await {
        Ok(Some(u)) => u,
        _ => match user_repo.create(crate::repository::user_repo::CreateUserRequest { address: req.wallet_address.clone(), username: None, email: None, password_hash: None, salt: None, status: None }).await {
            Ok(u) => u,
            Err(e) => return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()>::error("USER_CREATE_FAILED", &format!("{}", e))))
        }
    };
    let market_id: i64 = if let Some(addr) = req.market_address.as_ref() {
        let row = sqlx::query("SELECT id FROM markets WHERE market_address = $1")
            .bind(addr)
            .fetch_optional(&state.db_pool)
            .await
            .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
        match row { Some(r) => r.try_get("id").unwrap_or(0), None => 0 }
    } else { 0 };
    if market_id == 0 { return Ok(HttpResponse::NotFound().json(ApiResponse::<()>::error("MARKET_NOT_FOUND", "market_address not found"))); }
    let mut odds = (req.multiplier_bps as f64) / 10000.0;
    if req.selected_team == 1 { if let Some(bps) = req.odds_home_bps { odds = (bps as f64) / 10000.0; }}
    if req.selected_team == 2 { if let Some(bps) = req.odds_away_bps { odds = (bps as f64) / 10000.0; }}
    let option: i16 = if req.selected_team == 1 { 0 } else { 1 };
    let order_id: i64 = if let Some(sig) = req.transaction_signature { (xxhash_rust::xxh3::xxh3_64(sig.as_bytes()) as i64).abs() } else { chrono::Utc::now().timestamp_millis() };
    let repo = OrderRepository::new(state.db_pool.clone());
    match repo.create_with_audit(crate::repository::order_repo::CreateOrderRequest { order_id, user_id: user.id, market_id, amount: req.amount, odds, option }).await {
        Ok(order) => Ok(HttpResponse::Ok().json(ApiResponse::success(order))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(ApiResponse::<()>::error("ORDER_CREATE_FAILED", &format!("{}", e))))
    }
}

#[derive(Deserialize)]
pub struct CloseFrontendPositionRequest { pub position_id: i64, pub wallet_address: Option<String>, pub close_price: Option<f64> }

pub async fn close_frontend_position(state: web::Data<AppState>, body: web::Json<CloseFrontendPositionRequest>) -> Result<HttpResponse> {
    let req = body.into_inner();
    if req.position_id <= 0 { return Ok(HttpResponse::BadRequest().json(ApiResponse::<()>::error("INVALID_ARGS", "position_id required"))); }
    let order = sqlx::query("SELECT id, version FROM orders WHERE id = $1")
        .bind(req.position_id)
        .fetch_optional(&state.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    if order.is_none() { return Ok(HttpResponse::NotFound().json(ApiResponse::<()>::error("POSITION_NOT_FOUND", "position not found"))); }
    let row = order.unwrap();
    let version: i32 = row.try_get("version").unwrap_or(0);
    let repo = OrderRepository::new(state.db_pool.clone());
    match repo.update_status_with_version(req.position_id, version, OrderStatus::Cancelled).await {
        Ok(updated) => Ok(HttpResponse::Ok().json(ApiResponse::success(updated))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(ApiResponse::<()>::error("POSITION_CLOSE_FAILED", &format!("{}", e))))
    }
}