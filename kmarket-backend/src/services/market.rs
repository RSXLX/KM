use anyhow::Result;
use sqlx::PgPool;
use async_trait::async_trait;

use crate::models::market::Market;

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
        let rows: Vec<(i64, String, bool)> =
            sqlx::query_as("SELECT id, name, active FROM markets ORDER BY id")
                .fetch_all(&self.pool)
                .await?;

        Ok(rows
            .into_iter()
            .map(|(id, name, active)| Market { id, name, active })
            .collect())
    }

    async fn get_market(&self, id: i64) -> Result<Option<Market>> {
        let row: Option<(i64, String, bool)> =
            sqlx::query_as("SELECT id, name, active FROM markets WHERE id = $1")
                .bind(id)
                .fetch_optional(&self.pool)
                .await?;

        Ok(row.map(|(id, name, active)| Market { id, name, active }))
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