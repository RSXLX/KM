use anyhow::Result;
use sqlx::{PgPool, Row};

use crate::models::order::{Order, OrderStatus};
use crate::utils::errors::{DataAccessError, translate_sqlx_error};

pub struct OrderRepository { db_pool: PgPool }

impl OrderRepository {
    pub fn new(db_pool: PgPool) -> Self { Self { db_pool } }

    pub async fn create(&self, req: CreateOrderRequest) -> Result<Order, DataAccessError> {
        if req.order_id <= 0 || req.user_id <= 0 || req.market_id <= 0 || req.amount <= 0.0 || req.odds <= 0.0 || (req.option != 0 && req.option != 1) {
            return Err(DataAccessError::InvalidArgument("order fields".into()));
        }
        let rec = sqlx::query_as::<_, Order>(
            r#"
            INSERT INTO orders (order_id, user_id, market_id, amount, odds, option, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'placed')
            RETURNING id, order_id, user_id, market_id, amount::TEXT as amount, odds::TEXT as odds,
                      option, status, version, created_at, updated_at
            "#
        )
        .bind(req.order_id)
        .bind(req.user_id)
        .bind(req.market_id)
        .bind(req.amount)
        .bind(req.odds)
        .bind(req.option)
        .fetch_one(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;

        Ok(rec)
    }

    /// Create order and write audit log atomically in a transaction
    pub async fn create_with_audit(&self, req: CreateOrderRequest) -> Result<Order, DataAccessError> {
        if req.order_id <= 0 || req.user_id <= 0 || req.market_id <= 0 || req.amount <= 0.0 || req.odds <= 0.0 || (req.option != 0 && req.option != 1) {
            return Err(DataAccessError::InvalidArgument("order fields".into()));
        }
        let mut tx = self.db_pool.begin().await.map_err(translate_sqlx_error)?;

        let order = sqlx::query_as::<_, Order>(
            r#"
            INSERT INTO orders (order_id, user_id, market_id, amount, odds, option, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'placed')
            RETURNING id, order_id, user_id, market_id, amount::TEXT as amount, odds::TEXT as odds,
                      option, status, version, created_at, updated_at
            "#
        )
        .bind(req.order_id)
        .bind(req.user_id)
        .bind(req.market_id)
        .bind(req.amount)
        .bind(req.odds)
        .bind(req.option)
        .fetch_one(&mut *tx)
        .await
        .map_err(translate_sqlx_error)?;

        sqlx::query(
            r#"INSERT INTO order_audits (order_id, action, detail) VALUES ($1, 'created', '{}'::jsonb)"#
        )
        .bind(order.order_id)
        .execute(&mut *tx)
        .await
        .map_err(translate_sqlx_error)?;

        tx.commit().await.map_err(translate_sqlx_error)?;
        Ok(order)
    }

    pub async fn find_by_order_id(&self, order_id: i64) -> Result<Option<Order>, DataAccessError> {
        if order_id <= 0 { return Err(DataAccessError::InvalidArgument("order_id".into())); }
        let rec = sqlx::query_as::<_, Order>(
            r#"
            SELECT id, order_id, user_id, market_id, amount::TEXT as amount, odds::TEXT as odds,
                   option, status, version, created_at, updated_at
            FROM orders WHERE order_id = $1
            "#
        )
        .bind(order_id)
        .fetch_optional(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;
        Ok(rec)
    }

    pub async fn update_status_with_version(&self, id: i64, expected_version: i32, new_status: OrderStatus) -> Result<Order, DataAccessError> {
        if id <= 0 { return Err(DataAccessError::InvalidArgument("id".into())); }
        let rec = sqlx::query_as::<_, Order>(
            r#"
            UPDATE orders SET status = $1, version = version + 1
            WHERE id = $2 AND version = $3
            RETURNING id, order_id, user_id, market_id, amount::TEXT as amount, odds::TEXT as odds,
                      option, status, version, created_at, updated_at
            "#
        )
        .bind(new_status)
        .bind(id)
        .bind(expected_version)
        .fetch_optional(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?
        .ok_or(DataAccessError::ConcurrencyConflict("orders".into()))?;
        Ok(rec)
    }

    /// Cancel order with close fields (price, pnl, closed_at) and audit, with optimistic version check
    pub async fn cancel_with_close_fields(&self, id: i64, expected_version: i32, close_price: Option<f64>, close_pnl: Option<f64>) -> Result<Order, DataAccessError> {
        if id <= 0 { return Err(DataAccessError::InvalidArgument("id".into())); }
        let mut tx = self.db_pool.begin().await.map_err(translate_sqlx_error)?;
        let rec = sqlx::query_as::<_, Order>(
            r#"
            UPDATE orders
            SET status = 'cancelled', version = version + 1,
                closed_at = NOW(), close_price = COALESCE($1, close_price), close_pnl = COALESCE($2, close_pnl)
            WHERE id = $3 AND version = $4
            RETURNING id, order_id, user_id, market_id, amount::TEXT as amount, odds::TEXT as odds,
                      option, status, version, created_at, updated_at
            "#
        )
        .bind(close_price)
        .bind(close_pnl)
        .bind(id)
        .bind(expected_version)
        .fetch_optional(&mut *tx)
        .await
        .map_err(translate_sqlx_error)?
        .ok_or(DataAccessError::ConcurrencyConflict("orders".into()))?;

        sqlx::query(r#"INSERT INTO order_audits (order_id, action, detail) VALUES ($1, 'cancelled', '{}'::jsonb)"#)
            .bind(rec.order_id)
            .execute(&mut *tx)
            .await
            .map_err(translate_sqlx_error)?;

        tx.commit().await.map_err(translate_sqlx_error)?;
        Ok(rec)
    }

    /// Get orders for a user by address
    pub async fn get_user_orders_by_address(&self, address: &str) -> Result<Vec<Order>, DataAccessError> {
        if address.trim().is_empty() { return Err(DataAccessError::InvalidArgument("address".into())); }
        let rows = sqlx::query_as::<_, Order>(
            r#"
            SELECT o.id, o.order_id, o.user_id, o.market_id, o.amount::TEXT as amount, o.odds::TEXT as odds,
                   o.option, o.status, o.version, o.created_at, o.updated_at
            FROM orders o
            JOIN users u ON u.id = o.user_id
            WHERE u.address = $1
            ORDER BY o.created_at DESC
            "#
        )
        .bind(address)
        .fetch_all(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;
        Ok(rows)
    }

    /// Aggregate user stats by address
    pub async fn get_user_stats(&self, address: &str) -> Result<UserStats, DataAccessError> {
        if address.trim().is_empty() { return Err(DataAccessError::InvalidArgument("address".into())); }
        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE o.status = 'placed') AS placed,
                COUNT(*) FILTER (WHERE o.status = 'cancelled') AS cancelled,
                COUNT(*) FILTER (WHERE o.status = 'settled') AS settled,
                COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'placed'), 0)::TEXT AS amount_placed,
                COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'settled'), 0)::TEXT AS amount_settled
            FROM orders o
            JOIN users u ON u.id = o.user_id
            WHERE u.address = $1
            "#
        )
        .bind(address)
        .fetch_one(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;
        Ok(UserStats {
            placed: row.try_get("placed").unwrap_or(0),
            cancelled: row.try_get("cancelled").unwrap_or(0),
            settled: row.try_get("settled").unwrap_or(0),
            amount_placed: row.try_get("amount_placed").unwrap_or_else(|_| "0".into()),
            amount_settled: row.try_get("amount_settled").unwrap_or_else(|_| "0".into()),
        })
    }

    pub async fn delete_by_id(&self, id: i64) -> Result<(), DataAccessError> {
        if id <= 0 { return Err(DataAccessError::InvalidArgument("id".into())); }
        let mut tx = self.db_pool.begin().await.map_err(translate_sqlx_error)?;
        // Delete audits then order atomically
        sqlx::query("DELETE FROM order_audits WHERE order_id = (SELECT order_id FROM orders WHERE id = $1)")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(translate_sqlx_error)?;
        let rows_affected = sqlx::query("DELETE FROM orders WHERE id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(translate_sqlx_error)?
            .rows_affected();
        if rows_affected == 0 { return Err(DataAccessError::Database("order not found".into())); }
        tx.commit().await.map_err(translate_sqlx_error)?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct CreateOrderRequest {
    pub order_id: i64,
    pub user_id: i64,
    pub market_id: i64,
    pub amount: f64,
    pub odds: f64,
    pub option: i16,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct UserStats {
    pub placed: i64,
    pub cancelled: i64,
    pub settled: i64,
    pub amount_placed: String,
    pub amount_settled: String,
}