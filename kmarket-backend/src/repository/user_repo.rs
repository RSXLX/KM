use anyhow::Result;
use sqlx::PgPool;

use crate::models::user::User;
use crate::utils::errors::{DataAccessError, translate_sqlx_error};

pub struct UserRepository { db_pool: PgPool }

impl UserRepository {
    pub fn new(db_pool: PgPool) -> Self { Self { db_pool } }

    pub async fn create(&self, req: CreateUserRequest) -> Result<User, DataAccessError> {
        if req.address.trim().is_empty() { return Err(DataAccessError::InvalidArgument("address".into())); }
        let rec = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (address, username, email, password_hash, salt, status)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'active'))
            RETURNING id, address, username, email, password_hash, salt, status, version, created_at, updated_at
            "#
        )
        .bind(req.address)
        .bind(req.username)
        .bind(req.email)
        .bind(req.password_hash)
        .bind(req.salt)
        .bind(req.status)
        .fetch_one(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;
        Ok(rec)
    }

    pub async fn find_by_address(&self, address: &str) -> Result<Option<User>, DataAccessError> {
        if address.trim().is_empty() { return Err(DataAccessError::InvalidArgument("address".into())); }
        let rec = sqlx::query_as::<_, User>(
            r#"
            SELECT id, address, username, email, password_hash, salt, status, version, created_at, updated_at
            FROM users WHERE address = $1
            "#
        )
        .bind(address)
        .fetch_optional(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?;
        Ok(rec)
    }

    pub async fn update_email_with_version(&self, id: i64, expected_version: i32, new_email: &str) -> Result<User, DataAccessError> {
        if id <= 0 { return Err(DataAccessError::InvalidArgument("id".into())); }
        let rec = sqlx::query_as::<_, User>(
            r#"
            UPDATE users SET email = $1, version = version + 1
            WHERE id = $2 AND version = $3
            RETURNING id, address, username, email, password_hash, salt, status, version, created_at, updated_at
            "#
        )
        .bind(new_email)
        .bind(id)
        .bind(expected_version)
        .fetch_optional(&self.db_pool)
        .await
        .map_err(translate_sqlx_error)?
        .ok_or(DataAccessError::ConcurrencyConflict("users".into()))?;
        Ok(rec)
    }

    pub async fn delete_by_id(&self, id: i64) -> Result<(), DataAccessError> {
        if id <= 0 { return Err(DataAccessError::InvalidArgument("id".into())); }
        // Orders have ON DELETE CASCADE; delete user will cascade
        let rows_affected = sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(id)
            .execute(&self.db_pool)
            .await
            .map_err(translate_sqlx_error)?
            .rows_affected();
        if rows_affected == 0 { return Err(DataAccessError::Database("user not found".into())); }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct CreateUserRequest {
    pub address: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub password_hash: Option<String>,
    pub salt: Option<String>,
    pub status: Option<String>,
}