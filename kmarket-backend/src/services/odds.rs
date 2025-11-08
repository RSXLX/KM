use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoneylineOdds { pub home: f64, pub away: f64 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpreadOdds { pub line: f64, pub home: f64, pub away: f64 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TotalOdds { pub line: f64, pub over: f64, pub under: f64 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OddsQuote {
    pub market_id: i64,
    pub moneyline: Option<MoneylineOdds>,
    pub spread: Option<SpreadOdds>,
    pub total: Option<TotalOdds>,
    pub timestamp: i64,
    pub source: String,
}

/// 将整数 bps（如 185 -> 1.85）转换为 f64 赔率
fn bps_to_odds(bps: i32) -> f64 { (bps as f64) / 100.0 }

/// 从数据库计算基础 moneyline（根据 market_options code=1/2 或 label）
pub async fn compute_moneyline_from_db(pool: &PgPool, market_id: i64) -> Result<Option<MoneylineOdds>> {
    let rows: Vec<(i16, String, Option<i32>)> = sqlx::query_as(
        "SELECT code, label, initial_odds FROM market_options WHERE market_id = $1 AND code IN (1,2) ORDER BY code ASC"
    )
    .bind(market_id)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() { return Ok(None); }
    let mut home_bps: Option<i32> = None;
    let mut away_bps: Option<i32> = None;
    for (code, label, init) in rows {
        match (code, label.to_lowercase().as_str()) {
            (1, _) | (_, "home") => home_bps = init,
            (2, _) | (_, "away") => away_bps = init,
            _ => {}
        }
    }
    match (home_bps, away_bps) {
        (Some(h), Some(a)) => Ok(Some(MoneylineOdds { home: bps_to_odds(h), away: bps_to_odds(a) })),
        _ => Ok(None),
    }
}