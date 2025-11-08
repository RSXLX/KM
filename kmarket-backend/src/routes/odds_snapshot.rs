use actix_web::{get, web, HttpResponse, Responder};
use crate::{cache::store, services::odds::compute_moneyline_from_db, AppState};

#[get("/markets/{market_id}/odds/snapshot")]
pub async fn odds_snapshot(state: web::Data<AppState>, path: web::Path<i64>) -> impl Responder {
    let market_id = path.into_inner();
    if let Some(client) = &state.redis_client {
        if let Ok(mut conn) = store::get_conn(client).await {
            if let Ok(Some(q)) = store::get_odds_quote(&mut conn, market_id).await {
                let body = serde_json::json!({
                    "marketId": q.market_id,
                    "seq": 0,
                    "ts": q.timestamp,
                    "payload": { "moneyline": q.moneyline, "spread": q.spread, "total": q.total }
                });
                return HttpResponse::Ok().json(body);
            }
        }
    }
    // 回退：数据库计算 moneyline
    if let Some(pool) = &state.db_pool {
        if let Ok(Some(mo)) = compute_moneyline_from_db(pool, market_id).await {
            let now = chrono::Utc::now().timestamp_millis();
            let body = serde_json::json!({
                "marketId": market_id,
                "seq": 0,
                "ts": now,
                "payload": { "moneyline": mo }
            });
            return HttpResponse::Ok().json(body);
        }
    }
    HttpResponse::NotFound().json(serde_json::json!({"code":"NOT_FOUND","message":"snapshot not found"}))
}