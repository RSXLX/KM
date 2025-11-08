use actix_web::{get, web, HttpResponse, Responder};
use serde::Serialize;
use chrono::{Utc, NaiveDateTime};

use crate::{cache::store, services::odds::compute_moneyline_from_db, AppState};

#[derive(Serialize)]
struct StatusBody {
    isLive: bool,
    phase: Option<String>,
    minute: Option<i32>,
    second: Option<i32>,
    period: Option<i32>,
    time: String,
}

#[derive(Serialize)]
struct ScoreBody { home: i32, away: i32 }

#[derive(Serialize)]
struct InPlayItem {
    market_id: i64,
    title: String,
    category: String,
    status: StatusBody,
    score: ScoreBody,
    moneyline: Option<store::MoneylineOdds>,
    timestamp: i64,
    source: &'static str,
}

#[derive(Serialize)]
struct InPlayResponse { items: Vec<InPlayItem> }

#[get("/markets/inplay")]
pub async fn get_markets_inplay(state: web::Data<AppState>) -> impl Responder {
    let Some(pool) = &state.db_pool else {
        return HttpResponse::ServiceUnavailable().json(serde_json::json!({"code":"SERVICE_UNAVAILABLE","message":"database not configured"}));
    };

    // 查询 active 市场及其实时状态
    let rows: Result<Vec<(i64, String, String, Option<bool>, Option<String>, Option<i32>, Option<i32>, Option<i32>, Option<i32>, Option<i32>, Option<NaiveDateTime>)>, sqlx::Error> = sqlx::query_as(
        r#"
        SELECT m.market_id, m.title, m.category,
               ls.is_live, ls.phase, ls.minute, ls.second, ls.period, ls.home_score, ls.away_score, ls.last_updated
        FROM markets m
        LEFT JOIN market_live_state ls ON ls.market_id = m.market_id
        WHERE m.status = 'active'
        ORDER BY m.created_at DESC
        "#
    ).fetch_all(pool).await;

    let mut items: Vec<InPlayItem> = Vec::new();
    match rows {
        Ok(list) => {
            for (market_id, title, category, is_live_opt, phase_opt, minute_opt, second_opt, period_opt, home_score_opt, away_score_opt, last_updated_opt) in list {
                let is_live = is_live_opt.unwrap_or(true);
                let minute = minute_opt;
                let second = second_opt;
                let phase = phase_opt.clone();
                let period = period_opt;
                let time = if let (Some(ph), Some(min)) = (phase_opt.clone(), minute_opt) {
                    if let Some(sec) = second_opt { format!("{} {:02}:{:02}", ph, min, sec) } else { format!("{} {:02}'", ph, min) }
                } else {
                    "Live".to_string()
                };
                let status = StatusBody { isLive: is_live, phase, minute, second, period, time };
                let score = ScoreBody { home: home_score_opt.unwrap_or(0), away: away_score_opt.unwrap_or(0) };

                // 赔率：优先 Redis 复合报价，再回退 DB 计算 moneyline
                let mut moneyline: Option<store::MoneylineOdds> = None;
                let mut ts: i64 = last_updated_opt.map(|dt| dt.and_utc().timestamp_millis()).unwrap_or_else(|| Utc::now().timestamp_millis());
                let mut source: &'static str = "db";

                if let Some(client) = &state.redis_client {
                    if let Ok(mut conn) = store::get_conn(client).await {
                        if let Ok(Some(q)) = store::get_odds_quote(&mut conn, market_id).await {
                            moneyline = q.moneyline;
                            ts = q.timestamp;
                            source = "cache";
                        }
                    }
                }
                if moneyline.is_none() {
                    if let Ok(Some(mo)) = compute_moneyline_from_db(pool, market_id).await {
                        // convert services::odds::MoneylineOdds -> cache::store::MoneylineOdds
                        moneyline = Some(store::MoneylineOdds { home: mo.home, away: mo.away });
                        ts = Utc::now().timestamp_millis();
                        source = "db";
                    }
                }

                items.push(InPlayItem { market_id, title, category, status, score, moneyline, timestamp: ts, source });
            }
            HttpResponse::Ok().json(InPlayResponse { items })
        }
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({"code":"INTERNAL_ERROR","message": format!("query failed: {}", err) }))
    }
}