use anyhow::Result;
use async_trait::async_trait;
use sqlx::PgPool;

use crate::models::order::OrderRow;
use crate::models::order_claim::OrderClaim;

#[derive(Debug, Clone)]
pub struct PlaceOrder {
    pub order_id: i64,
    pub user_address: String,
    pub market_id: i64,
    pub amount_text: String,
    pub odds: i32,
    pub option: i16,
    pub potential_payout_text: Option<String>,
    pub tx_hash: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ListOrdersQuery {
    pub user_address: Option<String>,
    pub market_id: Option<i64>,
    pub settled: Option<bool>,
    pub page: i64,
    pub page_size: i64,
}

#[async_trait]
pub trait BettingService: Send + Sync {
    async fn place_order(&self, req: PlaceOrder) -> Result<OrderRow>;
    async fn get_order_by_id(&self, order_id: i64) -> Result<Option<OrderRow>>;
    async fn list_orders(&self, q: ListOrdersQuery) -> Result<Vec<OrderRow>>;
    async fn mark_claimed(&self, order_id: i64) -> Result<()>;
    async fn create_claim(
        &self,
        order_id: i64,
        claim_amount_text: &str,
        claimer_address: &str,
        claim_tx_hash: Option<&str>,
        status: &str,
    ) -> Result<OrderClaim>;
}

pub struct PgBettingService {
    pub pool: PgPool,
}

impl PgBettingService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl BettingService for PgBettingService {
    async fn place_order(&self, req: PlaceOrder) -> Result<OrderRow> {
        crate::db::repo::create_order(
            &self.pool,
            req.order_id,
            &req.user_address,
            req.market_id,
            &req.amount_text,
            req.odds,
            req.option,
            req.potential_payout_text.as_deref(),
            req.tx_hash.as_deref(),
        ).await
    }

    async fn get_order_by_id(&self, order_id: i64) -> Result<Option<OrderRow>> {
        crate::db::repo::get_order_by_id(&self.pool, order_id).await
    }

    async fn list_orders(&self, q: ListOrdersQuery) -> Result<Vec<OrderRow>> {
        crate::db::repo::list_orders(
            &self.pool,
            q.user_address.as_deref(),
            q.market_id,
            q.settled,
            q.page,
            q.page_size,
        ).await
    }

    async fn mark_claimed(&self, order_id: i64) -> Result<()> {
        crate::db::repo::mark_order_claimed(&self.pool, order_id).await
    }

    async fn create_claim(
        &self,
        order_id: i64,
        claim_amount_text: &str,
        claimer_address: &str,
        claim_tx_hash: Option<&str>,
        status: &str,
    ) -> Result<OrderClaim> {
        crate::db::repo::create_order_claim(
            &self.pool,
            order_id,
            claim_amount_text,
            claimer_address,
            claim_tx_hash,
            status,
        ).await
    }
}