use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use sqlx::Row;
use bigdecimal::BigDecimal;

use crate::state::AppState;
use crate::utils::response::ApiResponse;

#[derive(Deserialize)]
pub struct AdminMarketsQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub status: Option<String>,
    pub q: Option<String>,
}

pub async fn list_markets(state: web::Data<AppState>, query: web::Query<AdminMarketsQuery>) -> Result<HttpResponse> {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    let mut count_sql = String::from("SELECT COUNT(*) AS total FROM markets");
    let mut idx = 1;
    let mut has_where = false;
    if let Some(status) = &query.status {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("status = ${}", idx));
        idx += 1;
    }
    if let Some(_q) = &query.q {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("(title ILIKE ${} OR option_a ILIKE ${} OR option_b ILIKE ${})", idx, idx + 1, idx + 2));
        idx += 3;
    }
    let mut qc = sqlx::query(&count_sql);
    if let Some(status) = &query.status { qc = qc.bind(status); }
    if let Some(q) = &query.q { let pat = format!("%{}%", q); qc = qc.bind(pat.clone()).bind(pat.clone()).bind(pat); }
    let row = qc.fetch_one(&state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let total: i64 = row.try_get("total").unwrap_or(0);

    let mut data_sql = String::from(
        "SELECT id, market_id, title, description, option_a, option_b, start_time, end_time, status, winning_option, odds_home_bps, odds_away_bps, total_bets, total_volume FROM markets"
    );
    let mut idx2 = 1;
    let mut has_where2 = false;
    if let Some(status) = &query.status {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("status = ${}", idx2));
        idx2 += 1;
    }
    if let Some(_q) = &query.q {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("(title ILIKE ${} OR option_a ILIKE ${} OR option_b ILIKE ${})", idx2, idx2 + 1, idx2 + 2));
        idx2 += 3;
    }
    data_sql.push_str(&format!(" ORDER BY start_time DESC LIMIT ${} OFFSET ${}", idx2, idx2 + 1));
    let mut qd = sqlx::query(&data_sql);
    if let Some(status) = &query.status { qd = qd.bind(status); }
    if let Some(q) = &query.q { let pat = format!("%{}%", q); qd = qd.bind(pat.clone()).bind(pat.clone()).bind(pat); }
    qd = qd.bind(limit).bind(offset);
    let rows = qd.fetch_all(&state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let items: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.try_get::<i64, _>("id").unwrap_or_default(),
            "market_id": row.try_get::<i64, _>("market_id").unwrap_or_default(),
            "title": row.try_get::<String, _>("title").unwrap_or_default(),
            "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
            "option_a": row.try_get::<String, _>("option_a").unwrap_or_default(),
            "option_b": row.try_get::<String, _>("option_b").unwrap_or_default(),
            "start_time": row.try_get::<chrono::DateTime<chrono::Utc>, _>("start_time").ok(),
            "end_time": row.try_get::<chrono::DateTime<chrono::Utc>, _>("end_time").ok(),
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "winning_option": row.try_get::<Option<i16>, _>("winning_option").ok().flatten(),
            "odds_home_bps": row.try_get::<Option<i32>, _>("odds_home_bps").ok().flatten(),
            "odds_away_bps": row.try_get::<Option<i32>, _>("odds_away_bps").ok().flatten(),
            "total_bets": row.try_get::<Option<i32>, _>("total_bets").ok().flatten(),
            "total_volume": row.try_get::<Option<bigdecimal::BigDecimal>, _>("total_volume").ok().flatten(),
        })
    }).collect();

    let body = serde_json::json!({
        "items": items,
        "pagination": { "page": page, "limit": limit, "total": total, "totalPages": ((total + limit - 1) / limit) }
    });
    Ok(HttpResponse::Ok().json(ApiResponse::success(body)))
}

#[derive(Deserialize)]
pub struct CreateAdminMarket {
    pub market_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub option_a: String,
    pub option_b: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub status: String,
    pub odds_home_bps: Option<i32>,
    pub odds_away_bps: Option<i32>,
    pub home_name: Option<String>,
    pub away_name: Option<String>,
}

pub async fn create_market(state: web::Data<AppState>, payload: web::Json<CreateAdminMarket>) -> Result<HttpResponse> {
    let p = payload.into_inner();
    if p.end_time <= p.start_time { return Ok(HttpResponse::BadRequest().json(ApiResponse::<()>::error("invalid_time", "end_time must be after start_time"))); }
    if !["pending","active","settled","cancelled"].contains(&p.status.as_str()) {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()>::error("invalid_status", "status must be one of pending/active/settled/cancelled")));
    }

    let rec = sqlx::query(
        r#"INSERT INTO markets (market_id, title, description, option_a, option_b, start_time, end_time, status, odds_home_bps, odds_away_bps, home_name, away_name, market_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id"#
    )
    .bind(p.market_id)
    .bind(&p.title)
    .bind(&p.description)
    .bind(&p.option_a)
    .bind(&p.option_b)
    .bind(p.start_time)
    .bind(p.end_time)
    .bind(&p.status)
    .bind(p.odds_home_bps)
    .bind(p.odds_away_bps)
    .bind(p.home_name)
    .bind(p.away_name)
    .bind(format!("market_{}", p.market_id))
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let id: i64 = rec.try_get("id").unwrap_or_default();

    // Audit
    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id, payload_json) VALUES ($1, $2, $3, $4, $5)")
        .bind(0i64)
        .bind("admin.market_create")
        .bind("markets")
        .bind(id)
        .bind(serde_json::json!({"market_id": p.market_id, "title": p.title}))
        .execute(&state.db_pool)
        .await;

    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": id}))))
}

#[derive(Deserialize)]
pub struct UpdateAdminMarket {
    pub title: Option<String>,
    pub description: Option<String>,
    pub option_a: Option<String>,
    pub option_b: Option<String>,
    pub start_time: Option<chrono::DateTime<chrono::Utc>>,
    pub end_time: Option<chrono::DateTime<chrono::Utc>>,
    pub status: Option<String>,
    pub odds_home_bps: Option<i32>,
    pub odds_away_bps: Option<i32>,
    pub home_name: Option<String>,
    pub away_name: Option<String>,
}

pub async fn update_market(state: web::Data<AppState>, path: web::Path<i64>, payload: web::Json<UpdateAdminMarket>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let p = payload.into_inner();
    let mut sets: Vec<String> = Vec::new();
    let mut binds: Vec<serde_json::Value> = Vec::new();

    macro_rules! push_set { ($field:expr, $val:expr) => {{ sets.push(format!("{} = ${}", $field, sets.len() + 1)); binds.push(serde_json::json!($val)); }} }

    if let Some(v) = p.title { push_set!("title", v); }
    if let Some(v) = p.description { push_set!("description", v); }
    if let Some(v) = p.option_a { push_set!("option_a", v); }
    if let Some(v) = p.option_b { push_set!("option_b", v); }
    if let Some(v) = p.start_time { push_set!("start_time", v); }
    if let Some(v) = p.end_time { push_set!("end_time", v); }
    if let Some(v) = p.status { push_set!("status", v); }
    if let Some(v) = p.odds_home_bps { push_set!("odds_home_bps", v); }
    if let Some(v) = p.odds_away_bps { push_set!("odds_away_bps", v); }
    if let Some(v) = p.home_name { push_set!("home_name", v); }
    if let Some(v) = p.away_name { push_set!("away_name", v); }

    if sets.is_empty() { return Ok(HttpResponse::BadRequest().json(ApiResponse::<()>::error("no_fields", "no fields to update"))); }
    let mut sql = format!("UPDATE markets SET {} WHERE id = ${} RETURNING id", sets.join(", "), sets.len() + 1);
    let mut q = sqlx::query(&sql);
    for v in binds {
        q = match v {
            serde_json::Value::String(s) => q.bind(s),
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() { q.bind(i) } else if let Some(f) = n.as_f64() { q.bind(f) } else { q.bind(n.to_string()) }
            },
            serde_json::Value::Bool(b) => q.bind(b),
            _ => {
                // Attempt common types
                if let Some(dt) = v.as_str() { q.bind(dt.to_string()) } else { q.bind(serde_json::to_string(&v).unwrap_or_default()) }
            }
        };
    }
    q = q.bind(id);
    let rec = q.fetch_one(&state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let rid: i64 = rec.try_get("id").unwrap_or(id);

    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)")
        .bind(0i64)
        .bind("admin.market_update")
        .bind("markets")
        .bind(rid)
        .execute(&state.db_pool)
        .await;

    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": rid}))))
}

pub async fn deactivate_market(state: web::Data<AppState>, path: web::Path<i64>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let rec = sqlx::query("UPDATE markets SET status = 'cancelled' WHERE id = $1 RETURNING id")
        .bind(id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let rid: i64 = rec.try_get("id").unwrap_or(id);
    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)")
        .bind(0i64)
        .bind("admin.market_deactivate")
        .bind("markets")
        .bind(rid)
        .execute(&state.db_pool)
        .await;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": rid, "status": "cancelled"}))))
}

#[derive(Deserialize)]
pub struct SettleAdminMarket { pub winning_option: i16, pub resolved_at: Option<chrono::DateTime<chrono::Utc>> }

pub async fn settle_market(state: web::Data<AppState>, path: web::Path<i64>, payload: web::Json<SettleAdminMarket>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let p = payload.into_inner();
    let resolved_at = p.resolved_at.unwrap_or_else(|| chrono::Utc::now());
    let rec = sqlx::query("UPDATE markets SET status = 'settled', winning_option = $1, resolved_at = $2 WHERE id = $3 RETURNING id")
        .bind(p.winning_option)
        .bind(resolved_at)
        .bind(id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let rid: i64 = rec.try_get("id").unwrap_or(id);
    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)")
        .bind(0i64)
        .bind("admin.market_settle")
        .bind("markets")
        .bind(rid)
        .execute(&state.db_pool)
        .await;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": rid, "status": "settled"}))))
}