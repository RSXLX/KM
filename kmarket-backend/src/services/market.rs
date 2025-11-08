use anyhow::Result;
use sqlx::PgPool;
use async_trait::async_trait;

use crate::models::market::{Market, MarketRow};

/// 市场服务抽象，方便替换实现（DB 或内存）
#[async_trait]
pub trait MarketService: Send + Sync {
    async fn list_markets(&self) -> Result<Vec<Market>>;
    async fn get_market(&self, id: i64) -> Result<Option<Market>>;
}

/// 基于 SQLx/Postgres 的市场服务实现
pub struct PgMarketService {
    pub pool: PgPool,
}

#[allow(dead_code)]
impl PgMarketService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[allow(dead_code)]
#[async_trait]
impl MarketService for PgMarketService {
    async fn list_markets(&self) -> Result<Vec<Market>> {
        let rows: Vec<MarketRow> = sqlx::query_as(
            "SELECT id, market_id, title, category, status, created_at, opened_at, closed_at, settled_at, winning_option, description, admin_user_id FROM markets ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(Market::from).collect())
    }

    async fn get_market(&self, id: i64) -> Result<Option<Market>> {
        let row: Option<MarketRow> = sqlx::query_as(
            "SELECT id, market_id, title, category, status, created_at, opened_at, closed_at, settled_at, winning_option, description, admin_user_id FROM markets WHERE market_id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Market::from))
    }
}

/// 内存实现，用于开发期或测试
pub struct InMemoryMarketService;

#[async_trait]
impl MarketService for InMemoryMarketService {
    async fn list_markets(&self) -> Result<Vec<Market>> {
        Ok(vec![
            Market {
                id: 1,
                name: "Demo Market A".into(),
                active: true,
            },
            Market {
                id: 2,
                name: "Demo Market B".into(),
                active: false,
            },
        ])
    }

    async fn get_market(&self, id: i64) -> Result<Option<Market>> {
        let list = self.list_markets().await?;
        Ok(list.into_iter().find(|m| m.id == id))
    }
}