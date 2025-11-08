use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketOption {
    pub id: i32,
    pub market_id: i64,
    pub code: i16,
    pub label: String,
    pub initial_odds: Option<i32>,
}