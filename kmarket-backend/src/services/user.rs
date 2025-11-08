use anyhow::Result;
use async_trait::async_trait;
use sqlx::PgPool;

use crate::models::user::User;

#[async_trait]
pub trait UserService: Send + Sync {
    async fn get_by_wallet(&self, wallet: &str) -> Result<Option<User>>;
    async fn ensure_login(&self, wallet: &str) -> Result<i32>; // 返回 user_id
    async fn update_last_login(&self, user_id: i32) -> Result<()>;
}

pub struct PgUserService { pub pool: PgPool }

impl PgUserService { pub fn new(pool: PgPool) -> Self { Self { pool } } }

#[async_trait]
impl UserService for PgUserService {
    async fn get_by_wallet(&self, wallet: &str) -> Result<Option<User>> {
        crate::db::repo::get_user_by_wallet(&self.pool, wallet).await
    }

    async fn ensure_login(&self, wallet: &str) -> Result<i32> {
        if let Some(u) = crate::db::repo::get_user_by_wallet(&self.pool, wallet).await? {
            let _ = crate::db::repo::update_user_last_login(&self.pool, u.id).await;
            Ok(u.id)
        } else {
            let u = crate::db::repo::create_user(&self.pool, wallet, None, "user").await?;
            let _ = crate::db::repo::update_user_last_login(&self.pool, u.id).await;
            Ok(u.id)
        }
    }

    async fn update_last_login(&self, user_id: i32) -> Result<()> {
        crate::db::repo::update_user_last_login(&self.pool, user_id).await
    }
}