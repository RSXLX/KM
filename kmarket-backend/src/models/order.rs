use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OrderRow {
    pub id: i32,
    pub order_id: i64,
    pub user_address: String,
    pub market_id: i64,
    pub amount: String,
    pub odds: i32,
    pub option: i16,
    pub potential_payout: Option<String>,
    pub settled: bool,
    pub claimed: bool,
    pub tx_hash: Option<String>,
    pub created_at: NaiveDateTime,
}