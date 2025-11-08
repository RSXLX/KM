use actix_web::{get, web, HttpResponse, Responder};
use serde::Serialize;
use tracing::warn;

use crate::{
    cache::store,
    AppState,
};

#[derive(Serialize)]
struct OddsResponse {
    marketId: i64,
    // 兼容旧字段（用于现有测试）
    odds_a: i32,
    odds_b: i32,
    // 新结构
    moneyline: Option<store::MoneylineOdds>,
    spread: Option<store::SpreadOdds>,
    total: Option<store::TotalOdds>,
    timestamp: i64,
    source: &'static str,
}

#[derive(Serialize)]
struct ErrorBody { code: &'static str, message: String }

#[get("/odds/{market_id}")]
pub async fn get_odds(state: web::Data<AppState>, path: web::Path<i64>) -> impl Responder {
    let market_id = path.into_inner();

    // 先尝试缓存（旧键 odds:{id} 与新键 oddsq:{id} 都尝试）
    if let Some(client) = &state.redis_client {
        match store::get_conn(client).await {
            Ok(mut conn) => match store::get_odds(&mut conn, market_id).await {
                Ok(Some(od)) => {
                    let body = OddsResponse {
                        marketId: od.market_id,
                        odds_a: od.odds_a,
                        odds_b: od.odds_b,
                    moneyline: Some(store::MoneylineOdds { home: (od.odds_a as f64)/100.0, away: (od.odds_b as f64)/100.0 }),
                    spread: None,
                    total: None,
                    timestamp: od.timestamp,
                    source: "cache",
                };
                    return HttpResponse::Ok().json(body);
                }
                Ok(None) => { /* miss, fallthrough to DB */ }
                Err(err) => {
                    warn!(error=%err, "Redis read failed, falling back to DB");
                }
            },
            Err(err) => {
                warn!(error=%err, "Redis manager init failed, falling back to DB");
            }
        }
        // 尝试新结构缓存
        if let Ok(mut conn) = store::get_conn(client).await {
            if let Ok(Some(q)) = store::get_odds_quote(&mut conn, market_id).await {
                let body = OddsResponse {
                    marketId: q.market_id,
                    odds_a: q.moneyline.as_ref().map(|m| (m.home*100.0) as i32).unwrap_or(0),
                    odds_b: q.moneyline.as_ref().map(|m| (m.away*100.0) as i32).unwrap_or(0),
                    moneyline: q.moneyline,
                    spread: q.spread,
                    total: q.total,
                    timestamp: q.timestamp,
                    source: "cache",
                };
                return HttpResponse::Ok().json(body);
            }
        }
    }

    // 未命中或降级：查询数据库
    if let Some(pool) = &state.db_pool {
        let rows: Result<Vec<(i16, Option<i32>)>, sqlx::Error> = sqlx::query_as(
            "SELECT code, initial_odds FROM market_options WHERE market_id = $1 AND code IN (1,2) ORDER BY code ASC"
        )
        .bind(market_id)
        .fetch_all(pool)
        .await;

        match rows {
            Ok(r) if !r.is_empty() => {
                // 期望代码 1 和 2
                let mut odds_a: i32 = 0;
                let mut odds_b: i32 = 0;
                for (code, init) in r {
                    match code {
                        1 => odds_a = init.unwrap_or(0),
                        2 => odds_b = init.unwrap_or(0),
                        _ => {}
                    }
                }
                let mut timestamp = chrono::Utc::now().timestamp_millis();

                // 写回缓存（最佳努力，不阻塞）
                if let Some(client) = &state.redis_client {
                    if let Ok(mut conn) = store::get_conn(client).await {
                        match store::set_odds(&mut conn, market_id, odds_a, odds_b).await {
                            Ok(od) => { timestamp = od.timestamp; }
                            Err(err) => warn!(error=%err, "Redis set_odds failed"),
                        }
                    }
                }

                let body = OddsResponse {
                    marketId: market_id,
                    odds_a: odds_a,
                    odds_b: odds_b,
                    moneyline: Some(store::MoneylineOdds { home: (odds_a as f64)/100.0, away: (odds_b as f64)/100.0 }),
                    spread: None,
                    total: None,
                    timestamp,
                    source: "db",
                };
                HttpResponse::Ok().json(body)
            }
            Ok(_) => {
                let body = ErrorBody { code: "NOT_FOUND", message: format!("market {} not found or missing options", market_id) };
                HttpResponse::NotFound().json(body)
            }
            Err(err) => {
                let body = ErrorBody { code: "INTERNAL_ERROR", message: format!("db query failed: {}", err) };
                HttpResponse::InternalServerError().json(body)
            }
        }
    } else {
        let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".to_string() };
        HttpResponse::ServiceUnavailable().json(body)
    }
}