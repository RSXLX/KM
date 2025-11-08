use anyhow::Result;
use redis::aio::Connection;
use redis::Client;
use serde::{Deserialize, Serialize};
use serde_json;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

// 键TTL常量，严格遵循规范
const TTL_ODDS_SECS: usize = 60;
const TTL_MARKETS_ACTIVE_SECS: usize = 30;
const TTL_SESSION_SECS: usize = 7 * 24 * 3600; // 7d
const TTL_NONCE_SECS: usize = 300; // 5m challenge nonce

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Odds {
    pub market_id: i64,
    pub odds_a: i32,
    pub odds_b: i32,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketSummary {
    pub market_id: i64,
    pub title: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub user_id: i32,
    pub address: String,
}

pub async fn get_conn(client: &Client) -> Result<Connection> {
    let conn = client.get_tokio_connection().await?;
    Ok(conn)
}

// Odds
pub async fn get_odds(conn: &mut Connection, market_id: i64) -> Result<Option<Odds>> {
    let key = format!("odds:{}", market_id);
    let val: Option<String> = redis::cmd("GET").arg(&key).query_async(conn).await?;
    let odds = val
        .and_then(|s| serde_json::from_str::<Odds>(&s).ok());
    Ok(odds)
}

pub async fn set_odds(conn: &mut Connection, market_id: i64, a: i32, b: i32) -> Result<Odds> {
    let key = format!("odds:{}", market_id);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
    let payload = Odds { market_id, odds_a: a, odds_b: b, timestamp: now };
    let json = serde_json::to_string(&payload)?;
    // SETEX key seconds value
    redis::cmd("SETEX").arg(&key).arg(TTL_ODDS_SECS).arg(json).query_async::<_, ()>(conn).await?;
    Ok(payload)
}

// Markets Active snapshot
pub async fn get_markets_active(conn: &mut Connection) -> Result<Option<Vec<MarketSummary>>> {
    let val: Option<String> = redis::cmd("GET").arg("markets:active").query_async(conn).await?;
    let list = val.and_then(|s| serde_json::from_str::<Vec<MarketSummary>>(&s).ok());
    Ok(list)
}

pub async fn set_markets_active(conn: &mut Connection, list: &[MarketSummary]) -> Result<()> {
    let json = serde_json::to_string(list)?;
    redis::cmd("SETEX").arg("markets:active").arg(TTL_MARKETS_ACTIVE_SECS).arg(json).query_async::<_, ()>(conn).await?;
    Ok(())
}

// Session
pub async fn create_session(conn: &mut Connection, token: &str, session: &SessionData) -> Result<()> {
    let key = format!("session:{}", token);
    let json = serde_json::to_string(session)?;
    redis::cmd("SETEX").arg(&key).arg(TTL_SESSION_SECS).arg(json).query_async::<_, ()>(conn).await?;
    Ok(())
}

pub async fn create_session_with_ttl(conn: &mut Connection, token: &str, session: &SessionData, ttl_secs: usize) -> Result<()> {
    let key = format!("session:{}", token);
    let json = serde_json::to_string(session)?;
    redis::cmd("SETEX").arg(&key).arg(ttl_secs).arg(json).query_async::<_, ()>(conn).await?;
    Ok(())
}

pub async fn get_session(conn: &mut Connection, token: &str) -> Result<Option<SessionData>> {
    let key = format!("session:{}", token);
    let val: Option<String> = redis::cmd("GET").arg(&key).query_async(conn).await?;
    Ok(val.and_then(|s| serde_json::from_str::<SessionData>(&s).ok()))
}

pub async fn revoke_session(conn: &mut Connection, token: &str) -> Result<()> {
    let key = format!("session:{}", token);
    redis::cmd("DEL").arg(&key).query_async::<_, ()>(conn).await?;
    Ok(())
}

// Nonce challenge
pub async fn issue_nonce(conn: &mut Connection, address: &str) -> Result<String> {
    let nonce = Uuid::new_v4().to_string();
    let key = format!("nonce:{}", address.to_lowercase());
    redis::cmd("SETEX").arg(&key).arg(TTL_NONCE_SECS).arg(&nonce).query_async::<_, ()>(conn).await?;
    Ok(nonce)
}

pub async fn consume_nonce(conn: &mut Connection, address: &str, nonce: &str) -> Result<bool> {
    let key = format!("nonce:{}", address.to_lowercase());
    let val: Option<String> = redis::cmd("GET").arg(&key).query_async(conn).await?;
    if let Some(current) = val {
        if current == nonce {
            // delete after consumption
            let _ = redis::cmd("DEL").arg(&key).query_async::<_, ()>(conn).await;
            return Ok(true);
        }
    }
    Ok(false)
}
// 复合赔率结构，符合文档 moneyline/spread/total 设计
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
}

pub async fn get_odds_quote(conn: &mut Connection, market_id: i64) -> Result<Option<OddsQuote>> {
    let key = format!("oddsq:{}", market_id);
    let val: Option<String> = redis::cmd("GET").arg(&key).query_async(conn).await?;
    Ok(val.and_then(|s| serde_json::from_str::<OddsQuote>(&s).ok()))
}

pub async fn set_odds_quote(conn: &mut Connection, quote: &OddsQuote) -> Result<()> {
    let key = format!("oddsq:{}", quote.market_id);
    let json = serde_json::to_string(quote)?;
    redis::cmd("SETEX").arg(&key).arg(TTL_ODDS_SECS).arg(json).query_async::<_, ()>(conn).await?;
    Ok(())
}