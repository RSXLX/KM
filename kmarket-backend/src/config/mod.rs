use dotenvy::dotenv;
use std::env;

/// 应用基础配置，集中管理环境变量
#[derive(Clone, Debug)]
pub struct AppConfig {
    pub bind_addr: String,
    pub bind_port: u16,
    pub database_url: Option<String>,
    pub redis_url: Option<String>,
    pub jwt_secret: Option<String>,
    pub jwt_iss: String,
    pub jwt_aud: String,
    pub jwt_exp_days: i64,
    pub bsc_rpc_url: Option<String>,
    pub contract_addr_prediction: Option<String>,
    pub skip_readyz_ping: bool,
}

impl AppConfig {
    /// 从 .env 与系统环境变量加载配置
    pub fn load() -> Self {
        let _ = dotenv(); // 加载 .env（若存在）

        let bind_addr = env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
        let bind_port = env::var("BIND_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(8080);

        let database_url = env::var("DATABASE_URL").ok();
        let redis_url = env::var("REDIS_URL").ok();
        let jwt_secret = env::var("JWT_SECRET").ok();
        let jwt_iss = env::var("JWT_ISS").unwrap_or_else(|_| "kmarket".to_string());
        let jwt_aud = env::var("JWT_AUD").unwrap_or_else(|_| "kmarket_users".to_string());
        let jwt_exp_days = env::var("JWT_EXP_DAYS").ok().and_then(|v| v.parse::<i64>().ok()).unwrap_or(7);
        let bsc_rpc_url = env::var("BSC_RPC_URL").ok();
        let contract_addr_prediction = env::var("CONTRACT_ADDR_PREDICTION").ok();
        let skip_readyz_ping = env::var("READYZ_SKIP_PING").ok().map(|v| v == "true").unwrap_or(false);

        Self {
            bind_addr,
            bind_port,
            database_url,
            redis_url,
            jwt_secret,
            jwt_iss,
            jwt_aud,
            jwt_exp_days,
            bsc_rpc_url,
            contract_addr_prediction,
            skip_readyz_ping,
        }
    }
}