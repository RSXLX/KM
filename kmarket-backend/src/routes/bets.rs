use actix_web::{get, post, web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
// tracing removed: no direct logging in this route

use crate::{
    errors::AppError,
    db,
    services::settlement,
    services::betting::{BettingService, PgBettingService, PlaceOrder, ListOrdersQuery},
    AppState,
};

#[derive(Deserialize)]
pub struct PostBetReq {
    pub marketId: i64,
    pub option: i16,
    pub amount: String, // numeric string
    pub odds: i32,      // integerized odds, e.g. 185
    pub maxSlippage: Option<String>,
}

#[derive(Serialize)]
pub struct OrderResp {
    pub orderId: i64,
    pub userAddress: String,
    pub marketId: i64,
    pub amount: String,
    pub odds: i32,
    pub option: i16,
    pub potentialPayout: Option<String>,
    pub settled: bool,
    pub claimed: bool,
    pub txHash: Option<String>,
}

fn validate_amount(amount: &str) -> Result<(), AppError> {
    if amount.is_empty() || !amount.chars().all(|c| c.is_ascii_digit()) { return Err(AppError::BadRequest("invalid amount".into())); }
    if amount.len() > 78 { return Err(AppError::BadRequest("amount too large".into())); }
    Ok(())
}

fn validate_odds(odds: i32) -> Result<(), AppError> {
    if odds <= 0 { return Err(AppError::BadRequest("invalid odds".into())); }
    Ok(())
}

#[post("/bets")]
pub async fn post_bets(state: web::Data<AppState>, body: web::Json<PostBetReq>) -> Result<impl Responder, AppError> {
    let Some(pool) = &state.db_pool else { return Err(AppError::ServiceUnavailable("database not configured".into())); };

    validate_amount(&body.amount)?;
    validate_odds(body.odds)?;

    // 校验市场与选项存在且市场状态允许下注
    let market = db::repo::get_market_by_id(pool, body.marketId).await.map_err(AppError::from)?;
    let Some(m) = market else { return Err(AppError::NotFound(format!("market {} not found", body.marketId))); };
    if !m.active { return Err(AppError::BadRequest("market not active".into())); }

    // 验证选项存在
    let opt_exists: Option<(i64, i16)> = sqlx::query_as("SELECT market_id, code FROM market_options WHERE market_id = $1 AND code = $2")
        .bind(body.marketId).bind(body.option).fetch_optional(pool).await.map_err(AppError::internal)?;
    if opt_exists.is_none() { return Err(AppError::BadRequest("option not found".into())); }

    // 简单生成 order_id（时间戳毫秒），真实环境应使用全局序列或外部 ID 服务
    let order_id = chrono::Utc::now().timestamp_millis();

    // 生成伪 tx_hash（用于占位）
    let tx_hash = Some(format!("0x{:064x}", order_id as i128));

    // TODO: 检查用户余额与 allowance（省略：需要链上与钱包集成）
    let user_address = "0xuser-demo".to_string(); // 如启用 JWT，可从 claims/会话中获取用户地址

    let svc = PgBettingService::new(pool.clone());
    let row = svc.place_order(PlaceOrder {
        order_id,
        user_address,
        market_id: body.marketId,
        amount_text: body.amount.clone(),
        odds: body.odds,
        option: body.option,
        potential_payout_text: None,
        tx_hash,
    }).await.map_err(AppError::from)?;

    let resp = OrderResp {
        orderId: row.order_id,
        userAddress: row.user_address,
        marketId: row.market_id,
        amount: row.amount,
        odds: row.odds,
        option: row.option,
        potentialPayout: row.potential_payout,
        settled: row.settled,
        claimed: row.claimed,
        txHash: row.tx_hash,
    };
    Ok(HttpResponse::Ok().json(resp))
}

#[get("/bets/{order_id}")]
pub async fn get_bet(state: web::Data<AppState>, path: web::Path<i64>) -> Result<impl Responder, AppError> {
    let Some(pool) = &state.db_pool else { return Err(AppError::ServiceUnavailable("database not configured".into())); };
    let order_id = path.into_inner();
    let svc = PgBettingService::new(pool.clone());
    if let Some(row) = svc.get_order_by_id(order_id).await.map_err(AppError::from)? {
        let resp = OrderResp {
            orderId: row.order_id,
            userAddress: row.user_address,
            marketId: row.market_id,
            amount: row.amount,
            odds: row.odds,
            option: row.option,
            potentialPayout: row.potential_payout,
            settled: row.settled,
            claimed: row.claimed,
            txHash: row.tx_hash,
        };
        Ok(HttpResponse::Ok().json(resp))
    } else {
        Err(AppError::NotFound(format!("order {} not found", order_id)))
    }
}

#[derive(Deserialize)]
pub struct ListQuery {
    pub userAddress: Option<String>,
    pub marketId: Option<i64>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub pageSize: Option<i64>,
}

#[derive(Serialize)]
pub struct ListResp { pub page: i64, pub pageSize: i64, pub total: i64, pub items: Vec<OrderResp> }

#[get("/bets")]
pub async fn list_bets(q: web::Query<ListQuery>, state: web::Data<AppState>) -> Result<impl Responder, AppError> {
    let Some(pool) = &state.db_pool else { return Err(AppError::ServiceUnavailable("database not configured".into())); };
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.pageSize.unwrap_or(20).clamp(1, 100);
    let settled = match q.status.as_deref() {
        Some("pending") => Some(false),
        Some("confirmed") => Some(true),
        _ => None,
    };
    let svc = PgBettingService::new(pool.clone());
    let rows = svc.list_orders(ListOrdersQuery {
        user_address: q.userAddress.clone(),
        market_id: q.marketId,
        settled,
        page,
        page_size,
    }).await.map_err(AppError::from)?;
    let items = rows
        .into_iter()
        .map(|row| OrderResp {
            orderId: row.order_id,
            userAddress: row.user_address,
            marketId: row.market_id,
            amount: row.amount,
            odds: row.odds,
            option: row.option,
            potentialPayout: row.potential_payout,
            settled: row.settled,
            claimed: row.claimed,
            txHash: row.tx_hash,
        })
        .collect::<Vec<_>>();
    let total = items.len() as i64; // 简化：未分页统计总数
    Ok(HttpResponse::Ok().json(ListResp { page, pageSize: page_size, total, items }))
}

#[post("/bets/{order_id}/claim")]
pub async fn claim_bet(state: web::Data<AppState>, path: web::Path<i64>) -> Result<impl Responder, AppError> {
    let Some(pool) = &state.db_pool else { return Err(AppError::ServiceUnavailable("database not configured".into())); };
    let order_id = path.into_inner();
    let svc = PgBettingService::new(pool.clone());
    let order = svc.get_order_by_id(order_id).await.map_err(AppError::from)?;
    let Some(row) = order else { return Err(AppError::NotFound(format!("order {} not found", order_id))); };
    if row.claimed { return Err(AppError::Conflict("already claimed".into())); }
    if !settlement::can_claim(pool, order_id).await.map_err(AppError::from)? { return Err(AppError::BadRequest("not claimable".into())); }

    let claim_tx_hash: Option<&str> = None; // 占位；真实场景调用链上领取方法
    let claim = svc.create_claim(
        order_id,
        row.potential_payout.as_deref().unwrap_or("0"),
        &row.user_address,
        claim_tx_hash,
        "success",
    ).await.map_err(AppError::from)?;
    svc.mark_claimed(order_id).await.map_err(AppError::from)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "orderId": order_id,
        "claimed": true,
        "claimAmount": claim.claim_amount,
        "claimTxHash": claim.claim_tx_hash,
    })))
}