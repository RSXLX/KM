use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use crate::state::AppState;
use crate::repository::order_repo::{OrderRepository, CreateOrderRequest};
use crate::utils::response::ApiResponse;

#[derive(Deserialize)]
pub struct CreateOrderBody {
    pub order_id: i64,
    pub user_id: i64,
    pub market_id: i64,
    pub amount: f64,
    pub odds: f64,
    pub option: i16,
}

pub async fn create_order(state: web::Data<AppState>, body: web::Json<CreateOrderBody>) -> Result<HttpResponse> {
    let repo = OrderRepository::new(state.db_pool.clone());
    let order = repo.create_with_audit(CreateOrderRequest {
        order_id: body.order_id,
        user_id: body.user_id,
        market_id: body.market_id,
        amount: body.amount,
        odds: body.odds,
        option: body.option,
    }).await.map_err(|e| actix_web::error::ErrorBadRequest(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(order)))
}

#[derive(Deserialize)]
pub struct AddressPath { pub address: String }

pub async fn get_user_orders(state: web::Data<AppState>, path: web::Path<AddressPath>) -> Result<HttpResponse> {
    let repo = OrderRepository::new(state.db_pool.clone());
    let orders = repo.get_user_orders_by_address(&path.address).await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(orders)))
}

pub async fn get_user_stats(state: web::Data<AppState>, path: web::Path<AddressPath>) -> Result<HttpResponse> {
    let repo = OrderRepository::new(state.db_pool.clone());
    let stats = repo.get_user_stats(&path.address).await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(stats)))
}

#[derive(Deserialize)]
pub struct OrderPath { pub id: i64 }

pub async fn get_order(state: web::Data<AppState>, path: web::Path<OrderPath>) -> Result<HttpResponse> {
    let repo = OrderRepository::new(state.db_pool.clone());
    let id = path.id;
    // translate id->order_id if necessary by lookup; here assume id as order_id for simplicity if not found by id
    let found = sqlx::query_as::<_, crate::models::order::Order>(
        r#"SELECT id, order_id, user_id, market_id, amount::TEXT as amount, odds::TEXT as odds,
            option, status, version, created_at, updated_at FROM orders WHERE id = $1"#
    )
    .bind(id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    match found {
        Some(order) => Ok(HttpResponse::Ok().json(ApiResponse::success(order))),
        None => Ok(HttpResponse::NotFound().json(ApiResponse::<()>::error("NOT_FOUND", "order not found"))),
    }
}

#[derive(Deserialize)]
pub struct UpdateOrderStatusBody { pub expected_version: i32, pub status: String }

pub async fn update_order_status(state: web::Data<AppState>, path: web::Path<OrderPath>, body: web::Json<UpdateOrderStatusBody>) -> Result<HttpResponse> {
    let id = path.id;
    let new_status = match body.status.as_str() {
        "placed" => crate::models::order::OrderStatus::Placed,
        "cancelled" => crate::models::order::OrderStatus::Cancelled,
        "settled" => crate::models::order::OrderStatus::Settled,
        _ => return Ok(HttpResponse::BadRequest().json(ApiResponse::<()>::error("INVALID_STATUS", "Unknown status"))),
    };
    let repo = OrderRepository::new(state.db_pool.clone());
    let updated = repo.update_status_with_version(id, body.expected_version, new_status)
        .await
        .map_err(|e| actix_web::error::ErrorConflict(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(updated)))
}

pub async fn delete_order(state: web::Data<AppState>, path: web::Path<OrderPath>) -> Result<HttpResponse> {
    let id = path.id;
    let repo = OrderRepository::new(state.db_pool.clone());
    repo.delete_by_id(id).await
        .map_err(|e| actix_web::error::ErrorNotFound(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"deleted": true, "id": id}))))
}