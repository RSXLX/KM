use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OrderClaim {
    pub id: i32,
    pub order_id: i64,
    pub claim_amount: String,
    pub claim_tx_hash: Option<String>,
    pub claimer_address: String,
    pub status: String,
    pub claimed_at: NaiveDateTime,
}