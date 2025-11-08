use actix_web::{get, web, HttpResponse, Responder};
use serde::Deserialize;
use tracing::warn;

use crate::{
    cache::store::{self, MarketSummary},
    AppState,
};

#[derive(Deserialize)]
pub struct ActiveQuery { #[serde(default)] pub forceRefresh: bool }

#[get("/markets/active")]
pub async fn get_markets_active(state: web::Data<AppState>, q: web::Query<ActiveQuery>) -> impl Responder {
    // 非强制刷新时优先读缓存
    if !q.forceRefresh {
        if let Some(client) = &state.redis_client {
            match store::get_conn(client).await {
                Ok(mut conn) => match store::get_markets_active(&mut conn).await {
                    Ok(Some(list)) => {
                        let body = serde_json::json!({
                            "source": "cache",
                            "data": list,
                        });
                        return HttpResponse::Ok().json(body);
                    }
                    Ok(None) => {}
                    Err(err) => warn!(error=%err, "Redis get_markets_active failed"),
                },
                Err(err) => warn!(error=%err, "Redis manager init failed"),
            }
        }
    }

    // 查询数据库并写回缓存
    if let Some(pool) = &state.db_pool {
        let rows: Result<Vec<(i64, String, String)>, sqlx::Error> = sqlx::query_as(
            "SELECT market_id, title, category FROM markets WHERE status = 'active' ORDER BY created_at DESC"
        )
        .fetch_all(pool)
        .await;

        match rows {
            Ok(vecs) => {
                let list: Vec<MarketSummary> = vecs.into_iter().map(|(mid, t, c)| MarketSummary { market_id: mid, title: t, category: c }).collect();
                if let Some(client) = &state.redis_client {
                    if let Ok(mut conn) = store::get_conn(client).await {
                        if let Err(err) = store::set_markets_active(&mut conn, &list).await {
                            warn!(error=%err, "Redis set_markets_active failed");
                        }
                    }
                }
                let body = serde_json::json!({
                    "source": "db",
                    "data": list,
                });
                HttpResponse::Ok().json(body)
            }
            Err(err) => {
                let body = serde_json::json!({ "code": "INTERNAL_ERROR", "message": format!("db query failed: {}", err) });
                HttpResponse::InternalServerError().json(body)
            }
        }
    } else {
        // 降级返回空快照
        let empty: Vec<MarketSummary> = Vec::new();
        let body = serde_json::json!({
            "source": "degraded",
            "data": empty,
        });
        HttpResponse::Ok().json(body)
    }
}