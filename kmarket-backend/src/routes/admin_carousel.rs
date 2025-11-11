use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use crate::state::AppState;
use crate::utils::response::ApiResponse;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CarouselItem {
    pub id: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub image_url: String,
    pub href: String,
    pub order: i64,
    pub enabled: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CreateCarouselItem {
    pub id: Option<String>,
    pub title: String,
    pub subtitle: Option<String>,
    pub image_url: String,
    pub href: String,
    pub order: Option<i64>,
    pub enabled: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateCarouselItem {
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub image_url: Option<String>,
    pub href: Option<String>,
    pub order: Option<i64>,
    pub enabled: Option<bool>,
}

pub async fn list_items(_req: HttpRequest, _state: web::Data<AppState>) -> Result<HttpResponse> {
    let rows = sqlx::query(
        "SELECT id, title, subtitle, image_url, href, \"order\", enabled, to_char(created_at, 'YYYY-MM-DD\"T\"HH24:MI:SSZ') AS created_at, to_char(updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SSZ') AS updated_at FROM carousel_items ORDER BY \"order\" ASC"
    )
    .fetch_all(&_state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let items: Vec<CarouselItem> = rows.into_iter().map(|row| CarouselItem {
        id: row.try_get::<String, _>("id").unwrap_or_default(),
        title: row.try_get::<String, _>("title").unwrap_or_default(),
        subtitle: row.try_get::<Option<String>, _>("subtitle").unwrap_or(None),
        image_url: row.try_get::<String, _>("image_url").unwrap_or_default(),
        href: row.try_get::<String, _>("href").unwrap_or_default(),
        order: row.try_get::<i64, _>("order").unwrap_or(0),
        enabled: row.try_get::<bool, _>("enabled").unwrap_or(true),
        created_at: row.try_get::<Option<String>, _>("created_at").unwrap_or(None),
        updated_at: row.try_get::<Option<String>, _>("updated_at").unwrap_or(None),
    }).collect();

    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({ "items": items }))))
}

pub async fn create_item(_req: HttpRequest, _state: web::Data<AppState>, payload: web::Json<CreateCarouselItem>) -> Result<HttpResponse> {
    let id = payload.id.clone().unwrap_or_else(|| format!("c{}", chrono::Utc::now().timestamp_millis()));
    let order = payload.order.unwrap_or(1);
    let enabled = payload.enabled.unwrap_or(true);

    let row = sqlx::query(
        "INSERT INTO carousel_items (id, title, subtitle, image_url, href, \"order\", enabled) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, title, subtitle, image_url, href, \"order\", enabled, to_char(created_at, 'YYYY-MM-DD\"T\"HH24:MI:SSZ') AS created_at, to_char(updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SSZ') AS updated_at"
    )
    .bind(&id)
    .bind(&payload.title)
    .bind(&payload.subtitle)
    .bind(&payload.image_url)
    .bind(&payload.href)
    .bind(order)
    .bind(enabled)
    .fetch_one(&_state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let item = CarouselItem {
        id: row.try_get::<String, _>("id").unwrap_or(id),
        title: row.try_get::<String, _>("title").unwrap_or_default(),
        subtitle: row.try_get::<Option<String>, _>("subtitle").unwrap_or(None),
        image_url: row.try_get::<String, _>("image_url").unwrap_or_default(),
        href: row.try_get::<String, _>("href").unwrap_or_default(),
        order: row.try_get::<i64, _>("order").unwrap_or(order),
        enabled: row.try_get::<bool, _>("enabled").unwrap_or(enabled),
        created_at: row.try_get::<Option<String>, _>("created_at").unwrap_or(None),
        updated_at: row.try_get::<Option<String>, _>("updated_at").unwrap_or(None),
    };

    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({ "item": item }))))
}

pub async fn update_item(_req: HttpRequest, _state: web::Data<AppState>, path: web::Path<String>, payload: web::Json<UpdateCarouselItem>) -> Result<HttpResponse> {
    let id = path.into_inner();

    let mut sets: Vec<String> = Vec::new();
    let mut binds: Vec<serde_json::Value> = Vec::new();
    macro_rules! push_set { ($field:expr, $val:expr) => {{ sets.push(format!("{} = ${}", $field, sets.len() + 1)); binds.push(serde_json::json!($val)); }} }

    if let Some(v) = &payload.title { push_set!("title", v); }
    if let Some(v) = &payload.subtitle { push_set!("subtitle", v); }
    if let Some(v) = &payload.image_url { push_set!("image_url", v); }
    if let Some(v) = &payload.href { push_set!("href", v); }
    if let Some(v) = &payload.order { push_set!("\"order\"", v); }
    if let Some(v) = &payload.enabled { push_set!("enabled", v); }

    if sets.is_empty() {
        // nothing to update
        let row = sqlx::query("SELECT id, title, subtitle, image_url, href, \"order\", enabled, to_char(created_at, 'YYYY-MM-DD\"T\"HH24:MI:SSZ') AS created_at, to_char(updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SSZ') AS updated_at FROM carousel_items WHERE id = $1")
            .bind(&id)
            .fetch_optional(&_state.db_pool)
            .await
            .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
        if let Some(row) = row {
            let item = CarouselItem {
                id: row.try_get::<String, _>("id").unwrap_or(id),
                title: row.try_get::<String, _>("title").unwrap_or_default(),
                subtitle: row.try_get::<Option<String>, _>("subtitle").unwrap_or(None),
                image_url: row.try_get::<String, _>("image_url").unwrap_or_default(),
                href: row.try_get::<String, _>("href").unwrap_or_default(),
                order: row.try_get::<i64, _>("order").unwrap_or(0),
                enabled: row.try_get::<bool, _>("enabled").unwrap_or(true),
                created_at: row.try_get::<Option<String>, _>("created_at").unwrap_or(None),
                updated_at: row.try_get::<Option<String>, _>("updated_at").unwrap_or(None),
            };
            return Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({ "item": item }))));
        } else {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()>::error("not_found", "carousel item not found")));
        }
    }

    let mut sql = format!("UPDATE carousel_items SET {} , updated_at = NOW() WHERE id = ${} RETURNING id, title, subtitle, image_url, href, \"order\", enabled, to_char(created_at, 'YYYY-MM-DD\"T\"HH24:MI:SSZ') AS created_at, to_char(updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SSZ') AS updated_at", sets.join(", "), sets.len() + 1);
    let mut q = sqlx::query(&sql);
    for v in binds {
        q = match v {
            serde_json::Value::String(s) => q.bind(s),
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() { q.bind(i) } else if let Some(f) = n.as_f64() { q.bind(f) } else { q.bind(n.to_string()) }
            },
            serde_json::Value::Bool(b) => q.bind(b),
            _ => {
                if let Some(dt) = v.as_str() { q.bind(dt.to_string()) } else { q.bind(serde_json::to_string(&v).unwrap_or_default()) }
            }
        };
    }
    q = q.bind(&id);
    let row = q.fetch_one(&_state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let item = CarouselItem {
        id: row.try_get::<String, _>("id").unwrap_or(id),
        title: row.try_get::<String, _>("title").unwrap_or_default(),
        subtitle: row.try_get::<Option<String>, _>("subtitle").unwrap_or(None),
        image_url: row.try_get::<String, _>("image_url").unwrap_or_default(),
        href: row.try_get::<String, _>("href").unwrap_or_default(),
        order: row.try_get::<i64, _>("order").unwrap_or(0),
        enabled: row.try_get::<bool, _>("enabled").unwrap_or(true),
        created_at: row.try_get::<Option<String>, _>("created_at").unwrap_or(None),
        updated_at: row.try_get::<Option<String>, _>("updated_at").unwrap_or(None),
    };
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({ "item": item }))))
}

pub async fn delete_item(_req: HttpRequest, _state: web::Data<AppState>, path: web::Path<String>) -> Result<HttpResponse> {
    let id = path.into_inner();
    let res = sqlx::query("DELETE FROM carousel_items WHERE id = $1")
        .bind(&id)
        .execute(&_state.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    if res.rows_affected() > 0 {
        Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({ "deleted": true, "id": id }))))
    } else {
        Ok(HttpResponse::NotFound().json(ApiResponse::<()>::error("not_found", "carousel item not found")))
    }
}