use redis::Client;
use tracing::{info, warn};

use crate::config::AppConfig;

/// 初始化 Redis 客户端（若未配置 REDIS_URL 则返回 None）
pub async fn init_redis(cfg: &AppConfig) -> Option<Client> {
    let Some(url) = cfg.redis_url.as_ref() else {
        warn!("REDIS_URL not set; skipping Redis init");
        return None;
    };

    match Client::open(url.clone()) {
        Ok(client) => {
            info!("Redis client initialized");
            Some(client)
        }
        Err(err) => {
            warn!(error = %err, "Invalid REDIS_URL; continue without cache");
            None
        }
    }
}

/// 简单 PING 检查 Redis 是否可用
pub async fn ping(client: &Client) -> bool {
    match client.get_multiplexed_tokio_connection().await {
        Ok(mut conn) => redis::cmd("PING").query_async::<_, String>(&mut conn).await.is_ok(),
        Err(_) => false,
    }
}

pub mod store;