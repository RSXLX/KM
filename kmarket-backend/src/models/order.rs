use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[sqlx(type_name = "order_status", rename_all = "lowercase")]
pub enum OrderStatus {
    Placed,
    Cancelled,
    Settled,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Order {
    pub id: i64,
    pub order_id: i64,
    pub user_id: i64,
    pub market_id: i64,
    pub amount: String, // NUMERIC as String to avoid precision issues
    pub odds: String,
    pub option: i16,
    pub status: OrderStatus,
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}