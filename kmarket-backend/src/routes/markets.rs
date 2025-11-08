use actix_web::{get, web, HttpResponse, Responder};
use serde::Serialize;
use chrono::NaiveDateTime;

use crate::{
    errors::AppError,
    models::market::Market,
    services::market::{InMemoryMarketService, MarketService, PgMarketService},
    services::odds::{compute_moneyline_from_db},
    cache::store,
    AppState,
};

#[derive(serde::Deserialize)]
pub struct MarketsQuery {
    pub league: Option<String>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub pageSize: Option<i64>,
    pub sortBy: Option<String>,
    pub order: Option<String>,
}

#[derive(Serialize)]
struct MarketItem {
    id: i64,
    league: String,
    title: String,
    status: String,
    start_time: Option<i64>,
    odds: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct MarketListResponse {
    page: i64,
    pageSize: i64,
    total: i64,
    items: Vec<MarketItem>,
}

#[get("/markets")]
pub async fn list_markets(q: web::Query<MarketsQuery>, state: web::Data<AppState>) -> Result<impl Responder, AppError> {
    // 无数据库时返回内存 demo（保持测试兼容）
    if state.db_pool.is_none() {
        let svc: Box<dyn MarketService> = Box::new(InMemoryMarketService);
        let markets: Vec<Market> = svc.list_markets().await.map_err(AppError::from)?;
        return Ok(HttpResponse::Ok().json(markets));
    }

    let pool = state.db_pool.as_ref().unwrap();
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.pageSize.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * page_size;
    let sort_by = q.sortBy.clone().unwrap_or("created_at".to_string());
    let order = q.order.clone().unwrap_or("asc".to_string());

    // 基本筛选（league->category，status），动态计算占位符索引
    let mut where_clause = String::from(" WHERE 1=1 ");
    let mut filter_param_count = 0usize;
    if q.league.is_some() {
        filter_param_count += 1;
        where_clause.push_str(&format!(" AND category = ${}", filter_param_count));
    }
    if q.status.is_some() {
        filter_param_count += 1;
        where_clause.push_str(&format!(" AND status = ${}", filter_param_count));
    }

    let mut sql = String::from("SELECT id, market_id, title, category, status::text AS status, created_at, opened_at FROM markets");
    sql.push_str(&where_clause);
    let limit_idx = filter_param_count + 1;
    let offset_idx = filter_param_count + 2;
    sql.push_str(&format!(" ORDER BY {} {} LIMIT ${} OFFSET ${}", sort_by, order, limit_idx, offset_idx));

    // 执行查询（按存在的筛选项绑定参数）
    let mut query = sqlx::query_as::<_, (i32, i64, String, String, String, NaiveDateTime, Option<NaiveDateTime>)>(&sql);
    if let Some(l) = &q.league { query = query.bind(l); }
    if let Some(s) = &q.status { query = query.bind(s); }
    query = query.bind(page_size).bind(offset);
    let rows = query.fetch_all(pool).await.map_err(AppError::internal)?;

    // 总数
    let total: (i64,) = match (q.league.as_ref(), q.status.as_ref()) {
        (Some(l), Some(s)) => sqlx::query_as("SELECT COUNT(*) FROM markets WHERE category = $1 AND status = $2").bind(l).bind(s).fetch_one(pool).await.map_err(AppError::internal)?,
        (Some(l), None) => sqlx::query_as("SELECT COUNT(*) FROM markets WHERE category = $1").bind(l).fetch_one(pool).await.map_err(AppError::internal)?,
        (None, Some(s)) => sqlx::query_as("SELECT COUNT(*) FROM markets WHERE status = $1").bind(s).fetch_one(pool).await.map_err(AppError::internal)?,
        (None, None) => sqlx::query_as("SELECT COUNT(*) FROM markets").fetch_one(pool).await.map_err(AppError::internal)?,
    };

    // 组装 items，并聚合当前赔率（moneyline）
    let mut items: Vec<MarketItem> = Vec::new();
    for (_id, market_id, title, category, status, created_at, opened_at) in rows {
        // 先读缓存（新结构）；未命中回退 DB 计算
        let mut odds_json: Option<serde_json::Value> = None;
        if let Some(client) = &state.redis_client {
            if let Ok(mut conn) = store::get_conn(client).await {
                if let Ok(Some(q)) = store::get_odds_quote(&mut conn, market_id).await {
                    odds_json = Some(serde_json::json!({
                        "moneyline": q.moneyline,
                        "spread": q.spread,
                        "total": q.total,
                        "timestamp": q.timestamp,
                        "source": "cache"
                    }));
                }
            }
        }
        if odds_json.is_none() {
            if let Some(pool) = &state.db_pool {
                if let Ok(Some(m)) = compute_moneyline_from_db(pool, market_id).await {
                    odds_json = Some(serde_json::json!({
                        "moneyline": m,
                        "timestamp": chrono::Utc::now().timestamp_millis(),
                        "source": "db"
                    }));
                }
            }
        }

        items.push(MarketItem {
            id: market_id,
            league: category,
            title,
            status,
            start_time: opened_at.map(|dt| dt.and_utc().timestamp_millis()).or(Some(created_at.and_utc().timestamp_millis())),
            odds: odds_json,
        });
    }

    let resp = MarketListResponse { page, pageSize: page_size, total: total.0, items };
    Ok(HttpResponse::Ok().json(resp))
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
        Some(m) => {
            // 若 DB 存在，聚合当前赔率
            if let Some(pool) = &state.db_pool {
                // 缓存优先
                let mut odds_json: Option<serde_json::Value> = None;
                if let Some(client) = &state.redis_client {
                    if let Ok(mut conn) = store::get_conn(client).await {
                        if let Ok(Some(q)) = store::get_odds_quote(&mut conn, id).await {
                            odds_json = Some(serde_json::json!({
                                "moneyline": q.moneyline,
                                "spread": q.spread,
                                "total": q.total,
                                "timestamp": q.timestamp,
                                "source": "cache"
                            }));
                        }
                    }
                }
                if odds_json.is_none() {
                    if let Ok(Some(mo)) = compute_moneyline_from_db(pool, id).await {
                        odds_json = Some(serde_json::json!({
                            "moneyline": mo,
                            "timestamp": chrono::Utc::now().timestamp_millis(),
                            "source": "db"
                        }));
                    }
                }

                let body = serde_json::json!({ "market": m, "odds": odds_json });
                Ok(HttpResponse::Ok().json(body))
            } else {
                Ok(HttpResponse::Ok().json(m))
            }
        }
        None => Err(AppError::NotFound(format!("market {id} not found"))),
    }
}
