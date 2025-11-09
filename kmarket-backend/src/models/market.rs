use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[sqlx(type_name = "market_status", rename_all = "lowercase")]
pub enum MarketStatus {
    Pending,
    Active,
    Settled,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Market {
    pub id: i64,
    pub market_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub option_a: String,
    pub option_b: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub status: MarketStatus,
    pub winning_option: Option<i16>,
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketStats {
    pub bets_a: i64,
    pub bets_b: i64,
    pub amount_a: String,
    pub amount_b: String,
    pub total_orders: i64,
}