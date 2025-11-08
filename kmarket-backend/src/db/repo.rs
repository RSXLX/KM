use anyhow::Result;
use sqlx::{PgPool};

use crate::models::{
    market::{Market, MarketRow},
    market_option::MarketOption,
    order::OrderRow,
    user::User,
    order_claim::OrderClaim,
};

// 用户仓储
pub async fn get_user_by_wallet(pool: &PgPool, wallet: &str) -> Result<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, wallet_address, display_name, role, last_login, created_at FROM users WHERE wallet_address = $1",
    )
    .bind(wallet)
    .fetch_optional(pool)
    .await?;
    Ok(user)
}

pub async fn create_user(pool: &PgPool, wallet: &str, display_name: Option<&str>, role: &str) -> Result<User> {
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (wallet_address, display_name, role) VALUES ($1, $2, $3)
         RETURNING id, wallet_address, display_name, role, last_login, created_at",
    )
    .bind(wallet)
    .bind(display_name)
    .bind(role)
    .fetch_one(pool)
    .await?;
    Ok(user)
}

pub async fn update_user_last_login(pool: &PgPool, user_id: i32) -> Result<()> {
    sqlx::query("UPDATE users SET last_login = NOW() WHERE id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

// 市场仓储
pub async fn list_markets(pool: &PgPool) -> Result<Vec<Market>> {
    let rows = sqlx::query_as::<_, MarketRow>(
        "SELECT id, market_id, title, category, status, created_at, opened_at, closed_at, settled_at, winning_option, description, admin_user_id
         FROM markets ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(Market::from).collect())
}

pub async fn get_market_by_id(pool: &PgPool, market_id: i64) -> Result<Option<Market>> {
    let row = sqlx::query_as::<_, MarketRow>(
        "SELECT id, market_id, title, category, status, created_at, opened_at, closed_at, settled_at, winning_option, description, admin_user_id
         FROM markets WHERE market_id = $1",
    )
    .bind(market_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(Market::from))
}

pub async fn create_market(pool: &PgPool, market_id: i64, title: &str, category: &str, admin_user_id: Option<i32>) -> Result<MarketRow> {
    let row = sqlx::query_as::<_, MarketRow>(
        "INSERT INTO markets (market_id, title, category, status, admin_user_id)
         VALUES ($1, $2, $3, 'draft', $4)
         RETURNING id, market_id, title, category, status, created_at, opened_at, closed_at, settled_at, winning_option, description, admin_user_id",
    )
    .bind(market_id)
    .bind(title)
    .bind(category)
    .bind(admin_user_id)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn create_market_option(pool: &PgPool, market_id: i64, code: i16, label: &str, initial_odds: Option<i32>) -> Result<MarketOption> {
    let opt = sqlx::query_as::<_, MarketOption>(
        "INSERT INTO market_options (market_id, code, label, initial_odds)
         VALUES ($1, $2, $3, $4)
         RETURNING id, market_id, code, label, initial_odds",
    )
    .bind(market_id)
    .bind(code)
    .bind(label)
    .bind(initial_odds)
    .fetch_one(pool)
    .await?;
    Ok(opt)
}

// 订单仓储
pub async fn create_order(
    pool: &PgPool,
    order_id: i64,
    user_address: &str,
    market_id: i64,
    amount_text: &str,
    odds: i32,
    option: i16,
    potential_payout_text: Option<&str>,
    tx_hash: Option<&str>,
) -> Result<OrderRow> {
    let row = sqlx::query_as::<_, OrderRow>(
        "INSERT INTO orders (order_id, user_address, market_id, amount, odds, option, potential_payout, tx_hash)
         VALUES ($1, $2, $3, $4::numeric, $5, $6, $7::numeric, $8)
         RETURNING id, order_id, user_address, market_id, amount::text as amount, odds, option, potential_payout::text as potential_payout, settled, claimed, tx_hash, created_at",
    )
    .bind(order_id)
    .bind(user_address)
    .bind(market_id)
    .bind(amount_text)
    .bind(odds)
    .bind(option)
    .bind(potential_payout_text)
    .bind(tx_hash)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn get_orders_by_user(pool: &PgPool, user_address: &str) -> Result<Vec<OrderRow>> {
    let rows = sqlx::query_as::<_, OrderRow>(
        "SELECT id, order_id, user_address, market_id, amount::text as amount, odds, option, potential_payout::text as potential_payout, settled, claimed, tx_hash, created_at
         FROM orders WHERE user_address = $1 ORDER BY created_at DESC",
    )
    .bind(user_address)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_order_by_id(pool: &PgPool, order_id: i64) -> Result<Option<OrderRow>> {
    let row = sqlx::query_as::<_, OrderRow>(
        "SELECT id, order_id, user_address, market_id, amount::text as amount, odds, option, potential_payout::text as potential_payout, settled, claimed, tx_hash, created_at
         FROM orders WHERE order_id = $1",
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn list_orders(
    pool: &PgPool,
    user_address: Option<&str>,
    market_id: Option<i64>,
    settled: Option<bool>,
    page: i64,
    page_size: i64,
) -> Result<Vec<OrderRow>> {
    let mut sql = String::from(
        "SELECT id, order_id, user_address, market_id, amount::text as amount, odds, option, potential_payout::text as potential_payout, settled, claimed, tx_hash, created_at FROM orders WHERE 1=1",
    );
    let mut bind_idx = 1;
    if user_address.is_some() { sql.push_str(&format!(" AND user_address = ${}", bind_idx)); bind_idx += 1; }
    if market_id.is_some() { sql.push_str(&format!(" AND market_id = ${}", bind_idx)); bind_idx += 1; }
    if settled.is_some() { sql.push_str(&format!(" AND settled = ${}", bind_idx)); bind_idx += 1; }
    sql.push_str(" ORDER BY created_at DESC LIMIT $X OFFSET $Y");
    let sql = sql.replace("$X", &bind_idx.to_string()).replace("$Y", &(bind_idx + 1).to_string());

    let mut q = sqlx::query_as::<_, OrderRow>(&sql);
    if let Some(ua) = user_address { q = q.bind(ua); }
    if let Some(mid) = market_id { q = q.bind(mid); }
    if let Some(s) = settled { q = q.bind(s); }
    q = q.bind(page_size).bind((page - 1) * page_size);
    let rows = q.fetch_all(pool).await?;
    Ok(rows)
}

pub async fn mark_order_claimed(pool: &PgPool, order_id: i64) -> Result<()> {
    sqlx::query("UPDATE orders SET claimed = true WHERE order_id = $1")
        .bind(order_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn create_order_claim(
    pool: &PgPool,
    order_id: i64,
    claim_amount_text: &str,
    claimer_address: &str,
    claim_tx_hash: Option<&str>,
    status: &str,
) -> Result<OrderClaim> {
    let row = sqlx::query_as::<_, OrderClaim>(
        "INSERT INTO order_claims (order_id, claim_amount, claimer_address, claim_tx_hash, status)
         VALUES ($1, $2::numeric, $3, $4, $5)
         RETURNING id, order_id, claim_amount::text as claim_amount, claim_tx_hash, claimer_address, status, claimed_at",
    )
    .bind(order_id)
    .bind(claim_amount_text)
    .bind(claimer_address)
    .bind(claim_tx_hash)
    .bind(status)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

// 管理操作：写入赔率覆盖记录（使用 admin_actions 表作为审计）
pub async fn create_odds_override(
    pool: &PgPool,
    admin_user_id: i32,
    market_id: i64,
    payload_json: serde_json::Value,
) -> Result<i64> {
    let row: (i64,) = sqlx::query_as(
        "INSERT INTO admin_actions (admin_user_id, action_type, resource_type, resource_id, payload)
         VALUES ($1, 'ODDS_OVERRIDE', 'market', $2::text, $3)
         RETURNING id"
    )
    .bind(admin_user_id)
    .bind(market_id.to_string())
    .bind(payload_json)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

// 读取最近一次覆盖值（如存在）
pub async fn get_latest_odds_override(pool: &PgPool, market_id: i64) -> Result<Option<serde_json::Value>> {
    let row: Option<(serde_json::Value,)> = sqlx::query_as(
        "SELECT payload FROM admin_actions
         WHERE action_type = 'ODDS_OVERRIDE' AND resource_type = 'market' AND resource_id = $1::text
         ORDER BY created_at DESC LIMIT 1"
    )
    .bind(market_id.to_string())
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(p,)| p))
}