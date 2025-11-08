use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// 详细市场结构，匹配数据库设计
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketRow {
    pub id: i32,
    pub market_id: i64,
    pub title: String,
    pub category: String,
    pub status: String,
    pub created_at: NaiveDateTime,
    pub opened_at: Option<NaiveDateTime>,
    pub closed_at: Option<NaiveDateTime>,
    pub settled_at: Option<NaiveDateTime>,
    pub winning_option: Option<i16>,
    pub description: Option<String>,
    pub admin_user_id: Option<i32>,
}

// API 简化模型，向下兼容现有路由返回
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub id: i64,
    pub name: String,
    pub active: bool,
}

impl From<MarketRow> for Market {
    fn from(row: MarketRow) -> Self {
        Self {
            id: row.market_id,
            name: row.title,
            active: row.status == "active",
        }
    }
}