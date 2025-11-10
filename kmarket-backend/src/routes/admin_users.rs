use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use sqlx::Row;

use crate::state::AppState;
use crate::utils::response::ApiResponse;

#[derive(Deserialize)]
pub struct AdminUsersQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub q: Option<String>,
    pub status: Option<String>,
    pub blacklisted: Option<bool>,
    pub whitelisted: Option<bool>,
}

pub async fn list_users(state: web::Data<AppState>, query: web::Query<AdminUsersQuery>) -> Result<HttpResponse> {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    let mut count_sql = String::from("SELECT COUNT(*) AS total FROM users u");
    let mut idx = 1;
    let mut has_where = false;
    if let Some(status) = &query.status {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("u.status = ${}", idx)); idx += 1;
    }
    if let Some(blacklisted) = query.blacklisted {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("u.blacklisted = ${}", idx)); idx += 1;
    }
    if let Some(whitelisted) = query.whitelisted {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("u.whitelisted = ${}", idx)); idx += 1;
    }
    if let Some(_q) = &query.q {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("(u.address ILIKE ${} OR u.username ILIKE ${} OR u.email ILIKE ${})", idx, idx + 1, idx + 2)); idx += 3;
    }
    let mut qc = sqlx::query(&count_sql);
    if let Some(status) = &query.status { qc = qc.bind(status); }
    if let Some(blacklisted) = query.blacklisted { qc = qc.bind(blacklisted); }
    if let Some(whitelisted) = query.whitelisted { qc = qc.bind(whitelisted); }
    if let Some(q) = &query.q { let pat = format!("%{}%", q); qc = qc.bind(pat.clone()).bind(pat.clone()).bind(pat); }
    let row = qc.fetch_one(&state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let total: i64 = row.try_get("total").unwrap_or(0);

    let mut data_sql = String::from(
        "SELECT u.id, u.address, u.username, u.email, u.status, u.total_pnl, u.balance, u.blacklisted, u.whitelisted, u.created_at, u.updated_at FROM users u"
    );
    let mut idx2 = 1;
    let mut has_where2 = false;
    if let Some(status) = &query.status {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("u.status = ${}", idx2)); idx2 += 1;
    }
    if let Some(blacklisted) = query.blacklisted {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("u.blacklisted = ${}", idx2)); idx2 += 1;
    }
    if let Some(whitelisted) = query.whitelisted {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("u.whitelisted = ${}", idx2)); idx2 += 1;
    }
    if let Some(_q) = &query.q {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("(u.address ILIKE ${} OR u.username ILIKE ${} OR u.email ILIKE ${})", idx2, idx2 + 1, idx2 + 2)); idx2 += 3;
    }
    data_sql.push_str(&format!(" ORDER BY u.created_at DESC LIMIT ${} OFFSET ${}", idx2, idx2 + 1));
    let mut qd = sqlx::query(&data_sql);
    if let Some(status) = &query.status { qd = qd.bind(status); }
    if let Some(blacklisted) = query.blacklisted { qd = qd.bind(blacklisted); }
    if let Some(whitelisted) = query.whitelisted { qd = qd.bind(whitelisted); }
    if let Some(q) = &query.q { let pat = format!("%{}%", q); qd = qd.bind(pat.clone()).bind(pat.clone()).bind(pat); }
    qd = qd.bind(limit).bind(offset);
    let rows = qd.fetch_all(&state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let items: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.try_get::<i64, _>("id").unwrap_or_default(),
            "address": row.try_get::<String, _>("address").unwrap_or_default(),
            "username": row.try_get::<Option<String>, _>("username").ok().flatten(),
            "email": row.try_get::<Option<String>, _>("email").ok().flatten(),
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "total_pnl": row.try_get::<Option<bigdecimal::BigDecimal>, _>("total_pnl").ok().flatten().map(|d| d.to_string()),
            "balance": row.try_get::<Option<bigdecimal::BigDecimal>, _>("balance").ok().flatten().map(|d| d.to_string()),
            "blacklisted": row.try_get::<bool, _>("blacklisted").unwrap_or(false),
            "whitelisted": row.try_get::<bool, _>("whitelisted").unwrap_or(false),
            "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
            "updated_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").ok(),
        })
    }).collect();

    let body = serde_json::json!({ "items": items, "pagination": { "page": page, "limit": limit, "total": total, "totalPages": ((total + limit - 1) / limit) } });
    Ok(HttpResponse::Ok().json(ApiResponse::success(body)))
}

pub async fn get_user_detail(state: web::Data<AppState>, path: web::Path<i64>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let row = sqlx::query("SELECT id, address, username, email, status, total_pnl, balance, blacklisted, whitelisted, created_at, updated_at FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    if let Some(row) = row {
        let item = serde_json::json!({
            "id": row.try_get::<i64, _>("id").unwrap_or_default(),
            "address": row.try_get::<String, _>("address").unwrap_or_default(),
            "username": row.try_get::<Option<String>, _>("username").ok().flatten(),
            "email": row.try_get::<Option<String>, _>("email").ok().flatten(),
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "total_pnl": row.try_get::<Option<bigdecimal::BigDecimal>, _>("total_pnl").ok().flatten().map(|d| d.to_string()),
            "balance": row.try_get::<Option<bigdecimal::BigDecimal>, _>("balance").ok().flatten().map(|d| d.to_string()),
            "blacklisted": row.try_get::<bool, _>("blacklisted").unwrap_or(false),
            "whitelisted": row.try_get::<bool, _>("whitelisted").unwrap_or(false),
            "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
            "updated_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").ok(),
        });
        return Ok(HttpResponse::Ok().json(ApiResponse::success(item)));
    }
    Ok(HttpResponse::NotFound().json(ApiResponse::<()>::error("not_found", "user not found")))
}

#[derive(Deserialize)]
pub struct UpdateUserStatusRequest { pub status: String }

pub async fn update_user_status(state: web::Data<AppState>, path: web::Path<i64>, payload: web::Json<UpdateUserStatusRequest>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let status = payload.status.trim();
    let allowed = ["active", "disabled", "suspended"];
    if !allowed.contains(&status) { return Ok(HttpResponse::BadRequest().json(ApiResponse::<()>::error("invalid_status", "status invalid"))); }
    let rec = sqlx::query("UPDATE users SET status = $1 WHERE id = $2 RETURNING id")
        .bind(status)
        .bind(id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let rid: i64 = rec.try_get("id").unwrap_or(id);
    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id, payload_json) VALUES ($1, $2, $3, $4, $5)")
        .bind(0i64).bind("admin.user_status").bind("users").bind(rid)
        .bind(serde_json::json!({"status": status}))
        .execute(&state.db_pool).await;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": rid, "status": status}))))
}

#[derive(Deserialize)]
pub struct FlagRequest { pub value: Option<bool> }

pub async fn set_blacklist(state: web::Data<AppState>, path: web::Path<i64>, payload: web::Json<FlagRequest>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let val = payload.value.unwrap_or(true);
    let rec = sqlx::query("UPDATE users SET blacklisted = $1 WHERE id = $2 RETURNING id")
        .bind(val)
        .bind(id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let rid: i64 = rec.try_get("id").unwrap_or(id);
    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id, payload_json) VALUES ($1, $2, $3, $4, $5)")
        .bind(0i64).bind("admin.user_blacklist").bind("users").bind(rid)
        .bind(serde_json::json!({"blacklisted": val}))
        .execute(&state.db_pool).await;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": rid, "blacklisted": val}))))
}

pub async fn set_whitelist(state: web::Data<AppState>, path: web::Path<i64>, payload: web::Json<FlagRequest>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let val = payload.value.unwrap_or(true);
    let rec = sqlx::query("UPDATE users SET whitelisted = $1 WHERE id = $2 RETURNING id")
        .bind(val)
        .bind(id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let rid: i64 = rec.try_get("id").unwrap_or(id);
    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id, payload_json) VALUES ($1, $2, $3, $4, $5)")
        .bind(0i64).bind("admin.user_whitelist").bind("users").bind(rid)
        .bind(serde_json::json!({"whitelisted": val}))
        .execute(&state.db_pool).await;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"id": rid, "whitelisted": val}))))
}

pub async fn get_user_stats(state: web::Data<AppState>, path: web::Path<i64>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let row = sqlx::query(
        "SELECT u.total_pnl, u.balance, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count FROM users u WHERE u.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    if let Some(row) = row {
        let body = serde_json::json!({
            "total_pnl": row.try_get::<Option<bigdecimal::BigDecimal>, _>("total_pnl").ok().flatten().map(|d| d.to_string()),
            "balance": row.try_get::<Option<bigdecimal::BigDecimal>, _>("balance").ok().flatten().map(|d| d.to_string()),
            "order_count": row.try_get::<i64, _>("order_count").unwrap_or(0)
        });
        return Ok(HttpResponse::Ok().json(ApiResponse::success(body)));
    }
    Ok(HttpResponse::NotFound().json(ApiResponse::<()>::error("not_found", "user not found")))
}