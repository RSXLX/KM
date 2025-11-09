use anyhow::Result;
use sqlx::{PgPool, Row};

use crate::models::market::{Market, MarketStats, MarketStatus};
use crate::utils::errors::{DataAccessError, translate_sqlx_error};

pub struct MarketRepository {
    db_pool: PgPool,
}

impl MarketRepository {
    pub fn new(db_pool: PgPool) -> Self { Self { db_pool } }

    pub async fn get_active_markets(&self, limit: i64, offset: i64) -> Result<Vec<Market>, DataAccessError> {
        if limit <= 0 || offset < 0 { return Err(DataAccessError::InvalidArgument("limit/offset".into())); }
        let rows = sqlx::query_as::<_, Market>(
            r#"
            SELECT id, market_id, title, description, option_a, option_b,
                   start_time, end_time, status, winning_option, version,
                   created_at, updated_at
            FROM markets
            WHERE status = 'active' AND end_time > NOW()
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            "#
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;

        Ok(rows)
    }

    pub async fn find_by_market_id(&self, market_id: i64) -> Result<Option<Market>, DataAccessError> {
        if market_id <= 0 { return Err(DataAccessError::InvalidArgument("market_id".into())); }
        let row = sqlx::query_as::<_, Market>(
            r#"
            SELECT id, market_id, title, description, option_a, option_b,
                   start_time, end_time, status, winning_option, version,
                   created_at, updated_at
            FROM markets
            WHERE market_id = $1
            "#
        )
        .bind(market_id)
        .fetch_optional(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;
        Ok(row)
    }

    pub async fn get_market_stats(&self, market_id: i64) -> Result<MarketStats, DataAccessError> {
        if market_id <= 0 { return Err(DataAccessError::InvalidArgument("market_id".into())); }
        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE option = 0) as bets_a,
                COUNT(*) FILTER (WHERE option = 1) as bets_b,
                COALESCE(SUM(amount) FILTER (WHERE option = 0), 0)::TEXT as amount_a,
                COALESCE(SUM(amount) FILTER (WHERE option = 1), 0)::TEXT as amount_b,
                COUNT(*) as total_orders
            FROM orders WHERE market_id = $1
            "#
        )
        .bind(market_id)
        .fetch_one(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;

        Ok(MarketStats {
            bets_a: row.try_get::<i64, _>("bets_a").unwrap_or(0),
            bets_b: row.try_get::<i64, _>("bets_b").unwrap_or(0),
            amount_a: row.try_get::<String, _>("amount_a").unwrap_or_else(|_| "0".into()),
            amount_b: row.try_get::<String, _>("amount_b").unwrap_or_else(|_| "0".into()),
            total_orders: row.try_get::<i64, _>("total_orders").unwrap_or(0),
        })
    }

    pub async fn create(&self, m: CreateMarketRequest) -> Result<Market, DataAccessError> {
        if m.market_id <= 0 || m.title.trim().is_empty() { return Err(DataAccessError::InvalidArgument("market fields".into())); }
        let rec = sqlx::query_as::<_, Market>(
            r#"
            INSERT INTO markets (market_id, title, description, option_a, option_b, start_time, end_time, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING id, market_id, title, description, option_a, option_b,
                      start_time, end_time, status, winning_option, version,
                      created_at, updated_at
            "#
        )
        .bind(m.market_id)
        .bind(m.title)
        .bind(m.description)
        .bind(m.option_a)
        .bind(m.option_b)
        .bind(m.start_time)
        .bind(m.end_time)
        .fetch_one(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;

        Ok(rec)
    }

    pub async fn update_status_with_version(&self, id: i64, expected_version: i32, new_status: MarketStatus) -> Result<Market, DataAccessError> {
        if id <= 0 { return Err(DataAccessError::InvalidArgument("id".into())); }
        let rec = sqlx::query_as::<_, Market>(
            r#"
            UPDATE markets
            SET status = $1, version = version + 1
            WHERE id = $2 AND version = $3
            RETURNING id, market_id, title, description, option_a, option_b,
                      start_time, end_time, status, winning_option, version,
                      created_at, updated_at
            "#
        )
        .bind(new_status)
        .bind(id)
        .bind(expected_version)
        .fetch_optional(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?
        .ok_or(DataAccessError::ConcurrencyConflict("markets".into()))?;

        Ok(rec)
    }

    pub async fn delete_by_id(&self, id: i64) -> Result<(), DataAccessError> {
        if id <= 0 { return Err(DataAccessError::InvalidArgument("id".into())); }
        let mut tx = self.db_pool.begin().await.map_err(translate_sqlx_error)?;
        // Orders reference markets with ON DELETE CASCADE; delete market in transaction
        let rows_affected = sqlx::query("DELETE FROM markets WHERE id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(translate_sqlx_error)?
            .rows_affected();
        if rows_affected == 0 { return Err(DataAccessError::Database("market not found".into())); }
        tx.commit().await.map_err(translate_sqlx_error)?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct CreateMarketRequest {
    pub market_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub option_a: String,
    pub option_b: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
}