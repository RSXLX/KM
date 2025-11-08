use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AdminAction {
    pub id: i32,
    pub admin_user_id: i32,
    pub action_type: String,
    pub resource_type: String,
    pub resource_id: String,
    pub payload: serde_json::Value,
    pub created_at: NaiveDateTime,
}