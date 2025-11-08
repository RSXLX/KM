use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChainEvent {
    pub id: i32,
    pub event_type: String,
    pub tx_hash: String,
    pub block_number: i64,
    pub block_timestamp: NaiveDateTime,
    pub market_id: Option<i64>,
    pub order_id: Option<i64>,
    pub raw: serde_json::Value,
    pub created_at: NaiveDateTime,
}