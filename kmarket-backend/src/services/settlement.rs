use anyhow::Result;
use sqlx::PgPool;
use tracing::info;

/// 结算市场：设置胜方选项，并批量计算订单的潜在收益。
/// 规则：
/// - 胜方：potential_payout = amount * odds / 100（整数化赔率）
/// - 败方：potential_payout = 0
pub async fn settle_market(pool: &PgPool, market_id: i64, winning_option: i16) -> Result<()> {
    info!(market_id, winning_option, "settle_market start");

    // 更新市场状态为 settled，并写入 winning_option
    sqlx::query(
        "UPDATE markets SET status='settled', settled_at = NOW(), winning_option = $2 WHERE market_id = $1",
    )
    .bind(market_id)
    .bind(winning_option)
    .execute(pool)
    .await?;

    // 胜方订单：设置 settled=true，计算潜在收益（采用 DB 数值计算避免 Rust 端大整数问题）
    sqlx::query(
        "UPDATE orders SET settled = true, potential_payout = (amount * odds / 100)::numeric WHERE market_id = $1 AND option = $2",
    )
    .bind(market_id)
    .bind(winning_option)
    .execute(pool)
    .await?;

    // 败方订单：设置 settled=true，潜在收益=0
    sqlx::query(
        "UPDATE orders SET settled = true, potential_payout = 0::numeric WHERE market_id = $1 AND option <> $2",
    )
    .bind(market_id)
    .bind(winning_option)
    .execute(pool)
    .await?;

    info!(market_id, winning_option, "settle_market done");
    Ok(())
}

/// 校验可领取条件：订单已结算、潜在收益>0、未领取
pub async fn can_claim(pool: &PgPool, order_id: i64) -> Result<bool> {
    let row: Option<(bool, Option<String>, bool)> = sqlx::query_as(
        "SELECT settled, potential_payout::text, claimed FROM orders WHERE order_id = $1",
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?;

    match row {
        Some((settled, potential_payout_text, claimed)) => {
            if !settled || claimed { return Ok(false); }
            let payout_nonzero = potential_payout_text
                .and_then(|s| s.parse::<u128>().ok())
                .map(|v| v > 0)
                .unwrap_or(false);
            Ok(payout_nonzero)
        }
        None => Ok(false),
    }
}