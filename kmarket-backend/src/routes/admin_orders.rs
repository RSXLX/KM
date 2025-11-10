use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use sqlx::Row;
use bigdecimal::BigDecimal;
use bigdecimal::ToPrimitive;
use crate::state::AppState;
use crate::utils::response::ApiResponse;

#[derive(Deserialize)]
pub struct AdminOrdersQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub status: Option<String>,
    pub user: Option<String>,
    pub market_id: Option<i64>,
}

pub async fn list_orders(state: web::Data<AppState>, query: web::Query<AdminOrdersQuery>) -> Result<HttpResponse> {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    let mut count_sql = String::from("SELECT COUNT(*) AS total FROM orders o JOIN users u ON u.id = o.user_id JOIN markets m ON m.id = o.market_id");
    let mut idx = 1;
    let mut has_where = false;
    if let Some(status) = &query.status {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("o.status = ${}", idx)); idx += 1;
    }
    if let Some(user) = &query.user {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("u.address = ${}", idx)); idx += 1;
    }
    if let Some(market_id) = &query.market_id {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("m.market_id = ${}", idx)); idx += 1;
    }
    let mut qc = sqlx::query(&count_sql);
    if let Some(status) = &query.status { qc = qc.bind(status); }
    if let Some(user) = &query.user { qc = qc.bind(user); }
    if let Some(market_id) = &query.market_id { qc = qc.bind(market_id); }
    let row = qc.fetch_one(&state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let total: i64 = row.try_get("total").unwrap_or(0);

    let mut data_sql = String::from(
        "SELECT o.id, o.order_id, o.user_id, u.address AS wallet_address, o.market_id, m.market_id AS fixture_id, o.amount, o.odds, o.option, o.status, o.created_at, o.updated_at, o.closed_at, o.close_price, o.close_pnl FROM orders o JOIN users u ON u.id = o.user_id JOIN markets m ON m.id = o.market_id"
    );
    let mut idx2 = 1;
    let mut has_where2 = false;
    if let Some(status) = &query.status {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("o.status = ${}", idx2)); idx2 += 1;
    }
    if let Some(user) = &query.user {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("u.address = ${}", idx2)); idx2 += 1;
    }
    if let Some(market_id) = &query.market_id {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("m.market_id = ${}", idx2)); idx2 += 1;
    }
    data_sql.push_str(&format!(" ORDER BY o.created_at DESC LIMIT ${} OFFSET ${}", idx2, idx2 + 1));
    let mut qd = sqlx::query(&data_sql);
    if let Some(status) = &query.status { qd = qd.bind(status); }
    if let Some(user) = &query.user { qd = qd.bind(user); }
    if let Some(market_id) = &query.market_id { qd = qd.bind(market_id); }
    qd = qd.bind(limit).bind(offset);
    let rows = qd.fetch_all(&state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let items: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.try_get::<i64, _>("id").unwrap_or_default(),
            "order_id": row.try_get::<i64, _>("order_id").unwrap_or_default(),
            "user_id": row.try_get::<i64, _>("user_id").unwrap_or_default(),
            "wallet_address": row.try_get::<String, _>("wallet_address").unwrap_or_default(),
            "market_id": row.try_get::<i64, _>("market_id").unwrap_or_default(),
            "fixture_id": row.try_get::<i64, _>("fixture_id").unwrap_or_default(),
            "amount": row.try_get::<BigDecimal, _>("amount").unwrap_or_else(|_| BigDecimal::from(0)).to_string(),
            "odds": row.try_get::<BigDecimal, _>("odds").unwrap_or_else(|_| BigDecimal::from(0)).to_string(),
            "option": row.try_get::<i16, _>("option").unwrap_or_default(),
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
            "updated_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").ok(),
            "closed_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("closed_at").ok().flatten(),
            "close_price": row.try_get::<Option<BigDecimal>, _>("close_price").ok().flatten().map(|d| d.to_string()),
            "close_pnl": row.try_get::<Option<BigDecimal>, _>("close_pnl").ok().flatten().map(|d| d.to_string()),
        })
    }).collect();

    let body = serde_json::json!({ "items": items, "pagination": { "page": page, "limit": limit, "total": total, "totalPages": ((total + limit - 1) / limit) } });
    Ok(HttpResponse::Ok().json(ApiResponse::success(body)))
}

pub async fn get_order_detail(state: web::Data<AppState>, path: web::Path<i64>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let row = sqlx::query(
        "SELECT o.id, o.order_id, o.user_id, u.address AS wallet_address, o.market_id, m.market_id AS fixture_id, o.amount, o.odds, o.option, o.status, o.created_at, o.updated_at, o.closed_at, o.close_price, o.close_pnl FROM orders o JOIN users u ON u.id = o.user_id JOIN markets m ON m.id = o.market_id WHERE o.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    if let Some(row) = row {
        let item = serde_json::json!({
            "id": row.try_get::<i64, _>("id").unwrap_or_default(),
            "order_id": row.try_get::<i64, _>("order_id").unwrap_or_default(),
            "user_id": row.try_get::<i64, _>("user_id").unwrap_or_default(),
            "wallet_address": row.try_get::<String, _>("wallet_address").unwrap_or_default(),
            "market_id": row.try_get::<i64, _>("market_id").unwrap_or_default(),
            "fixture_id": row.try_get::<i64, _>("fixture_id").unwrap_or_default(),
            "amount": row.try_get::<BigDecimal, _>("amount").map(|v| v.to_string()).unwrap_or_else(|_| BigDecimal::from(0).to_string()),
            "odds": row.try_get::<BigDecimal, _>("odds").map(|v| v.to_string()).unwrap_or_else(|_| BigDecimal::from(0).to_string()),
            "option": row.try_get::<i16, _>("option").unwrap_or_default(),
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
            "updated_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").ok(),
            "closed_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("closed_at").ok().flatten(),
            "close_price": row.try_get::<Option<BigDecimal>, _>("close_price").ok().flatten().map(|d| d.to_string()),
            "close_pnl": row.try_get::<Option<BigDecimal>, _>("close_pnl").ok().flatten().map(|d| d.to_string()),
        });
        return Ok(HttpResponse::Ok().json(ApiResponse::success(item)));
    }
    Ok(HttpResponse::NotFound().json(ApiResponse::<()>::error("not_found", "order not found")))
}

#[derive(Deserialize)]
pub struct CancelOrderRequest { pub reason: Option<String> }

pub async fn cancel_order(state: web::Data<AppState>, path: web::Path<i64>, payload: web::Json<CancelOrderRequest>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let reason = payload.reason.clone();
    let mut tx = state.db_pool.begin().await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let exists = sqlx::query("SELECT status FROM orders WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    if let Some(r) = exists { let st: String = r.try_get("status").unwrap_or_default(); if st == "cancelled" { tx.rollback().await.ok(); return Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": id, "status": st})))); } }
    let rec = sqlx::query("UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING id")
        .bind(id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let rid: i64 = rec.try_get("id").unwrap_or(id);
    // audit
    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id, payload_json) VALUES ($1, $2, $3, $4, $5)")
        .bind(0i64).bind("admin.order_cancel").bind("orders").bind(rid)
        .bind(serde_json::json!({"reason": reason}))
        .execute(&mut *tx)
        .await;
    tx.commit().await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": rid, "status": "cancelled"}))))
}

#[derive(Deserialize)]
pub struct SettleOrderRequest { pub close_price: f64, pub closed_at: Option<chrono::DateTime<chrono::Utc>> }

pub async fn settle_order(state: web::Data<AppState>, path: web::Path<i64>, payload: web::Json<SettleOrderRequest>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let p = payload.into_inner();
    let closed_at = p.closed_at.unwrap_or_else(|| chrono::Utc::now());
    let mut tx = state.db_pool.begin().await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    // read order
    let row = sqlx::query("SELECT user_id, amount FROM orders WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let user_id: i64 = row.try_get("user_id").unwrap_or_default();
    let amount_dec: BigDecimal = row.try_get("amount").unwrap_or_else(|_| BigDecimal::from(0));
    let amount = amount_dec.to_f64().unwrap_or(0.0);
    let close_pnl = p.close_price - amount;

    // update order
    let _ = sqlx::query("UPDATE orders SET status = 'settled', closed_at = $1, close_price = $2, close_pnl = $3 WHERE id = $4")
        .bind(closed_at)
        .bind(p.close_price)
        .bind(close_pnl)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    // update user total_pnl
    let _ = sqlx::query("UPDATE users SET total_pnl = COALESCE(total_pnl, 0) + $1 WHERE id = $2")
        .bind(close_pnl)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    // audit
    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id, payload_json) VALUES ($1, $2, $3, $4, $5)")
        .bind(0i64).bind("admin.order_settle").bind("orders").bind(id)
        .bind(serde_json::json!({"close_price": p.close_price, "close_pnl": close_pnl}))
        .execute(&mut *tx)
        .await;

    tx.commit().await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": id, "status": "settled", "close_pnl": close_pnl}))))
}