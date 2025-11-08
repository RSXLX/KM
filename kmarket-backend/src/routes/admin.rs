use actix_web::{post, put, web, HttpResponse, Responder, HttpMessage};
use serde::{Deserialize, Serialize};
use tracing::{warn};

use crate::{
    db,
    routes::auth::Claims,
    routes::auth_middleware::auth_middleware,
    cache::store,
    services::settlement,
    AppState,
};

#[derive(Serialize)]
struct ErrorBody { code: &'static str, message: String }

fn claims_from_req(req: &actix_web::HttpRequest) -> Option<Claims> {
    req.extensions().get::<Claims>().cloned()
}

async fn require_admin(state: &AppState, claims: &Claims) -> Result<i32, HttpResponse> {
    // 从数据库确认用户角色为 admin
    if let Some(pool) = &state.db_pool {
        match db::repo::get_user_by_wallet(pool, &claims.address).await {
            Ok(Some(u)) if u.role == "admin" => Ok(u.id),
            Ok(Some(_)) => Err(HttpResponse::Forbidden().json(ErrorBody { code: "FORBIDDEN", message: "admin role required".to_string() })),
            Ok(None) => Err(HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "user not found".to_string() })),
            Err(err) => Err(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("db query failed: {}", err) })),
        }
    } else {
        Err(HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".to_string() }))
    }
}

#[derive(Deserialize)]
pub struct CreateMarketOption { pub r#type: String, pub line: Option<f64> }

#[derive(Deserialize)]
pub struct CreateMarketBody {
    pub league: String,
    pub home_team: String,
    pub away_team: String,
    pub start_time: i64,
    pub options: Option<Vec<CreateMarketOption>>, // moneyline/spread/total
}

#[post("/markets")]
pub async fn admin_create_market(state: web::Data<AppState>, req: actix_web::HttpRequest, body: web::Json<CreateMarketBody>) -> impl Responder {
    // 认证和授权
    let Some(claims) = claims_from_req(&req) else { return HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "missing token".to_string() }); };
    let admin_user_id = match require_admin(&state, &claims).await { Ok(id) => id, Err(resp) => return resp };

    let Some(pool) = &state.db_pool else { return HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".to_string() }); };

    // 生成 market_id（简单用时间戳+随机种子），真实环境用外部 match_id 或序列
    let market_id = chrono::Utc::now().timestamp_millis();
    let title = format!("{} vs {}", body.home_team.trim(), body.away_team.trim());
    let category = body.league.trim().to_string();
    match db::repo::create_market(pool, market_id, &title, &category, Some(admin_user_id)).await {
        Ok(row) => {
            // 默认创建 moneyline 选项（home/away），bps 初始空
            let _ = db::repo::create_market_option(pool, row.market_id, 1, "home", None).await;
            let _ = db::repo::create_market_option(pool, row.market_id, 2, "away", None).await;
            HttpResponse::Created().json(serde_json::json!({ "id": row.market_id }))
        }
        Err(err) => HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("create market failed: {}", err) }),
    }
}

#[derive(Deserialize)]
pub struct UpdateMarketBody { pub status: Option<String>, pub description: Option<String> }

#[put("/markets/{id}")]
pub async fn admin_update_market(state: web::Data<AppState>, req: actix_web::HttpRequest, path: web::Path<i64>, body: web::Json<UpdateMarketBody>) -> impl Responder {
    let Some(claims) = claims_from_req(&req) else { return HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "missing token".to_string() }); };
    let _admin_user_id = match require_admin(&state, &claims).await { Ok(id) => id, Err(resp) => return resp };
    let Some(pool) = &state.db_pool else { return HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".to_string() }); };
    let market_id = path.into_inner();

    // 简化：仅更新 status/description
    if let Some(status) = &body.status {
        if !["draft","active","closed","settled"].contains(&status.as_str()) {
            return HttpResponse::BadRequest().json(ErrorBody { code: "BAD_REQUEST", message: "invalid status".to_string() });
        }
    }
    // 执行更新
    if let Some(status) = &body.status {
        let _ = sqlx::query("UPDATE markets SET status = $1 WHERE market_id = $2").bind(status).bind(market_id).execute(pool).await;
    }
    if let Some(desc) = &body.description { let _ = sqlx::query("UPDATE markets SET description = $1 WHERE market_id = $2").bind(desc).bind(market_id).execute(pool).await; }
    HttpResponse::NoContent().finish()
}

#[derive(Deserialize)]
pub struct OddsOverrideBody { pub market_id: i64, pub payload: serde_json::Value, pub reason: Option<String> }

#[derive(Serialize)]
pub struct OddsOverrideResponse { pub override_id: i64, pub applied: bool }

#[post("/odds/override")]
pub async fn admin_odds_override(state: web::Data<AppState>, req: actix_web::HttpRequest, body: web::Json<OddsOverrideBody>) -> impl Responder {
    let Some(claims) = claims_from_req(&req) else { return HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "missing token".to_string() }); };
    let admin_user_id = match require_admin(&state, &claims).await { Ok(id) => id, Err(resp) => return resp };
    let Some(pool) = &state.db_pool else { return HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".to_string() }); };

    // 写审计
    let mut payload = body.payload.clone();
    if let Some(reason) = &body.reason { payload["reason"] = serde_json::Value::String(reason.clone()); }
    let override_id = match db::repo::create_odds_override(pool, admin_user_id, body.market_id, payload.clone()).await {
        Ok(id) => id,
        Err(err) => return HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("create odds override failed: {}", err) }),
    };

    // 写穿缓存（最佳努力）
    if let Some(client) = &state.redis_client {
        if let Ok(mut conn) = store::get_conn(client).await {
            let now = chrono::Utc::now().timestamp_millis();
            let quote = store::OddsQuote {
                market_id: body.market_id,
                moneyline: payload.get("moneyline").and_then(|m| {
                    let h = m.get("home")?.as_f64()?; let a = m.get("away")?.as_f64()?; Some(store::MoneylineOdds { home: h, away: a })
                }),
                spread: payload.get("spread").and_then(|s| {
                    let line = s.get("line")?.as_f64()?; let h = s.get("home")?.as_f64()?; let a = s.get("away")?.as_f64()?; Some(store::SpreadOdds { line, home: h, away: a })
                }),
                total: payload.get("total").and_then(|t| {
                    let line = t.get("line")?.as_f64()?; let over = t.get("over")?.as_f64()?; let under = t.get("under")?.as_f64()?; Some(store::TotalOdds { line, over, under })
                }),
                timestamp: now,
            };
            if let Err(err) = store::set_odds_quote(&mut conn, &quote).await { warn!(error=%err, "set_odds_quote failed"); }
        }
    }

    // WS 广播（最佳努力，不阻塞）
    if let Some(hub) = &state.ws_hub {
        let update_payload = serde_json::json!({
            "type": "odds_update",
            "payload": payload,
        });
        hub.do_send(crate::ws::BroadcastOdds { market_id: body.market_id, payload: update_payload });
    }

    HttpResponse::Created().json(OddsOverrideResponse { override_id, applied: true })
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        actix_web::web::scope("/admin")
            .wrap(actix_web_lab::middleware::from_fn(auth_middleware))
            .service(admin_create_market)
            .service(admin_update_market)
            .service(admin_odds_override)
            .service(admin_settle_market)
            .service(admin_update_live_state)
    );
}

#[derive(Deserialize)]
pub struct SettleBody { pub winning_option: i16 }

#[post("/markets/{id}/settle")]
pub async fn admin_settle_market(state: web::Data<AppState>, req: actix_web::HttpRequest, path: web::Path<i64>, body: web::Json<SettleBody>) -> impl Responder {
    let Some(claims) = claims_from_req(&req) else { return HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "missing token".to_string() }); };
    let _admin_user_id = match require_admin(&state, &claims).await { Ok(id) => id, Err(resp) => return resp };
    let Some(pool) = &state.db_pool else { return HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".to_string() }); };
    let market_id = path.into_inner();
    match settlement::settle_market(pool, market_id, body.winning_option).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "marketId": market_id, "winningOption": body.winning_option, "status": "settled" })),
        Err(err) => HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("settle failed: {}", err) }),
    }
}

#[derive(Deserialize)]
pub struct LiveUpdateBody {
    pub is_live: Option<bool>,
    pub phase: Option<String>,
    pub minute: Option<i32>,
    pub second: Option<i32>,
    pub period: Option<i32>,
    pub home_score: Option<i32>,
    pub away_score: Option<i32>,
}

/// 更新/写入 market_live_state 以维护实时比分与阶段（管理员）
#[post("/markets/{id}/live")]
pub async fn admin_update_live_state(state: web::Data<AppState>, req: actix_web::HttpRequest, path: web::Path<i64>, body: web::Json<LiveUpdateBody>) -> impl Responder {
    let Some(claims) = claims_from_req(&req) else { return HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "missing token".to_string() }); };
    let _admin_user_id = match require_admin(&state, &claims).await { Ok(id) => id, Err(resp) => return resp };
    let Some(pool) = &state.db_pool else { return HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".to_string() }); };
    let market_id = path.into_inner();

    // UPSERT 逻辑：若存在则更新，否则插入
    let exists: Result<Option<(i64,)>, sqlx::Error> = sqlx::query_as("SELECT market_id FROM market_live_state WHERE market_id = $1")
        .bind(market_id)
        .fetch_optional(pool)
        .await;
    if let Err(err) = exists { return HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("check failed: {}", err) }); }

    let now = chrono::Utc::now().naive_utc();
    let up = &body;
    if exists.unwrap().is_some() {
        let res = sqlx::query(
            r#"UPDATE market_live_state SET
                is_live = COALESCE($2, is_live),
                phase = COALESCE($3, phase),
                minute = COALESCE($4, minute),
                second = COALESCE($5, second),
                period = COALESCE($6, period),
                home_score = COALESCE($7, home_score),
                away_score = COALESCE($8, away_score),
                last_updated = $9
              WHERE market_id = $1"#
        )
        .bind(market_id)
        .bind(up.is_live)
        .bind(up.phase.as_ref())
        .bind(up.minute)
        .bind(up.second)
        .bind(up.period)
        .bind(up.home_score)
        .bind(up.away_score)
        .bind(now)
        .execute(pool)
        .await;
        if let Err(err) = res { return HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("update failed: {}", err) }); }
    } else {
        let res = sqlx::query(
            r#"INSERT INTO market_live_state (market_id, is_live, phase, minute, second, period, home_score, away_score, last_updated)
               VALUES ($1, COALESCE($2, true), $3, $4, $5, $6, COALESCE($7,0), COALESCE($8,0), $9)"#
        )
        .bind(market_id)
        .bind(up.is_live)
        .bind(up.phase.as_ref())
        .bind(up.minute)
        .bind(up.second)
        .bind(up.period)
        .bind(up.home_score)
        .bind(up.away_score)
        .bind(now)
        .execute(pool)
        .await;
        if let Err(err) = res { return HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("insert failed: {}", err) }); }
    }

    HttpResponse::Ok().json(serde_json::json!({ "marketId": market_id, "updated": true }))
}