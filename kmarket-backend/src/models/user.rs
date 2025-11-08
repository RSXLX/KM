use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: i32,
    pub wallet_address: String,
    pub display_name: Option<String>,
    pub role: String,
    pub last_login: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
}