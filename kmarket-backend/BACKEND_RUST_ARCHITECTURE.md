# Rust 后端架构设计

**创建时间**: 2025-11-04
**技术栈**: Rust + Actix-Web + Tokio + Solana SDK
**数据库**: PostgreSQL + Redis
**部署**: Docker + systemd

---

## 📋 目录

1. [架构总览](#架构总览)
2. [技术栈选型](#技术栈选型)
3. [项目结构](#项目结构)
4. [核心模块设计](#核心模块设计)
5. [API 设计](#api-设计)
6. [链上事件监听](#链上事件监听)
7. [实时赔率服务](#实时赔率服务)
8. [数据库设计](#数据库设计)
9. [部署配置](#部署配置)

---

## 架构总览

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Web3)                       │
│              (React/Next.js + @solana/web3.js)          │
└──────────────┬──────────────────┬──────────────────────┘
               │                  │
       HTTP API│          WebSocket│
               │                  │
┌──────────────▼──────────────────▼──────────────────────┐
│              Rust Backend Server (Actix-Web)            │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────┐ │
│  │  REST API      │  │  WebSocket     │  │  Cron    │ │
│  │  (Actix-Web)   │  │  (Actix-WS)    │  │  Jobs    │ │
│  └────────────────┘  └────────────────┘  └──────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Event Listener (Tokio Runtime)             │  │
│  │       (监听 Solana 链上事件)                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Solana Program Client (anchor-client)      │  │
│  │       (与 Anchor 合约交互)                        │  │
│  └──────────────────────────────────────────────────┘  │
└─────┬──────────────┬──────────────┬───────────────────┘
      │              │              │
┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────────────────┐
│PostgreSQL │  │  Redis  │  │  Solana RPC Node        │
│(SQLx)     │  │ (Cache) │  │  (Devnet/Mainnet)       │
└───────────┘  └─────────┘  └─────────────────────────┘
```

---

## 技术栈选型

### Rust 生态系统优势

```yaml
性能优势:
  - 零成本抽象，接近 C/C++ 性能
  - 无 GC，内存使用可预测
  - 并发安全（所有权系统）
  - 适合高并发 WebSocket 和实时数据处理

安全优势:
  - 编译时内存安全保证
  - 类型安全（强类型系统）
  - 无数据竞争（借用检查器）
  - 适合处理金融数据和私钥管理

生态优势:
  - Solana SDK 原生 Rust 支持
  - Anchor 框架官方 Rust client
  - 丰富的异步运行时（Tokio）
  - 成熟的 Web 框架（Actix-Web, Axum）
```

### 核心依赖

**Cargo.toml**:

```toml
[package]
name = "prediction-market-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
# Web 框架
actix-web = "4.5"
actix-ws = "0.2"          # WebSocket 支持
actix-cors = "0.7"        # CORS 支持
actix-rt = "2.9"          # Actix 运行时

# 异步运行时
tokio = { version = "1.36", features = ["full"] }
futures = "0.3"

# Solana SDK
solana-client = "1.18"
solana-sdk = "1.18"
anchor-client = "0.30"    # Anchor 客户端
anchor-lang = "0.30"

# 数据库
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio-rustls", "macros", "migrate", "chrono"] }
redis = { version = "0.25", features = ["tokio-comp", "connection-manager"] }

# 序列化
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# 日志
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# 错误处理
anyhow = "1.0"
thiserror = "1.0"

# 配置管理
config = "0.14"
dotenvy = "0.15"

# 时间处理
chrono = { version = "0.4", features = ["serde"] }

# 定时任务
tokio-cron-scheduler = "0.10"

# HTTP 客户端
reqwest = { version = "0.12", features = ["json"] }

[dev-dependencies]
tokio-test = "0.4"
```

---

## 项目结构

```
prediction-market-backend/
├── Cargo.toml
├── .env.example
├── migrations/              # SQLx 数据库迁移
│   └── 20250104_init.sql
├── src/
│   ├── main.rs             # 程序入口
│   ├── config/
│   │   └── mod.rs          # 配置管理
│   ├── models/
│   │   ├── mod.rs
│   │   ├── market.rs       # Market 数据模型
│   │   ├── bet.rs          # Bet 数据模型
│   │   ├── position.rs     # Position 数据模型
│   │   └── stats.rs        # Stats 数据模型
│   ├── db/
│   │   ├── mod.rs
│   │   ├── postgres.rs     # PostgreSQL 连接池
│   │   └── redis.rs        # Redis 连接池
│   ├── solana/
│   │   ├── mod.rs
│   │   ├── client.rs       # Solana Client 封装
│   │   ├── event_listener.rs  # 事件监听器
│   │   └── program.rs      # Anchor Program 客户端
│   ├── services/
│   │   ├── mod.rs
│   │   ├── odds.rs         # 赔率计算服务
│   │   ├── market.rs       # 市场服务
│   │   ├── user.rs         # 用户服务
│   │   └── settlement.rs   # 结算服务
│   ├── api/
│   │   ├── mod.rs
│   │   ├── platform.rs     # Platform API
│   │   ├── markets.rs      # Markets API
│   │   ├── users.rs        # Users API
│   │   └── stats.rs        # Stats API
│   ├── ws/
│   │   ├── mod.rs
│   │   └── handler.rs      # WebSocket 处理器
│   ├── errors.rs           # 错误定义
│   └── utils.rs            # 工具函数
├── Dockerfile
└── docker-compose.yml
```

---

## 核心模块设计

### 1. 配置管理 (src/config/mod.rs)

```rust
use config::{Config, ConfigError, Environment, File};
use serde::Deserialize;
use std::env;

#[derive(Debug, Deserialize, Clone)]
pub struct Settings {
    pub server: ServerConfig,
    pub solana: SolanaConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub ws_port: u16,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SolanaConfig {
    pub rpc_url: String,
    pub ws_url: String,
    pub program_id: String,
    pub authority_keypair: String, // Base58 编码的私钥
}

#[derive(Debug, Deserialize, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RedisConfig {
    pub url: String,
}

impl Settings {
    pub fn new() -> Result<Self, ConfigError> {
        let run_mode = env::var("RUN_MODE").unwrap_or_else(|_| "development".into());

        let s = Config::builder()
            // 从默认配置文件开始
            .add_source(File::with_name("config/default"))
            // 根据环境加载配置
            .add_source(File::with_name(&format!("config/{}", run_mode)).required(false))
            // 从环境变量覆盖（带 APP 前缀）
            .add_source(Environment::with_prefix("APP").separator("__"))
            .build()?;

        s.try_deserialize()
    }
}
```

### 2. 数据库模型 (src/models/market.rs)

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Market {
    pub id: i32,
    pub market_id: String,
    pub authority: String,
    pub vault: String,
    pub usdc_mint: String,
    pub option_a_name: String,
    pub option_b_name: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub status: MarketStatus,
    pub winning_option: Option<i16>,
    pub total_option_a: i64,
    pub total_option_b: i64,
    pub total_users: i32,
    pub created_at: DateTime<Utc>,
    pub settled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum MarketStatus {
    Pending,
    Active,
    Ended,
    Settled,
    Cancelled,
}

#[derive(Debug, Serialize)]
pub struct MarketWithOdds {
    #[serde(flatten)]
    pub market: Market,
    pub odds_a: f64,
    pub odds_b: f64,
}

impl Market {
    /// 计算实时赔率
    pub fn calculate_odds(&self, fee_rate: u16) -> (f64, f64) {
        let total_pool = self.total_option_a + self.total_option_b;

        if total_pool == 0 {
            return (0.0, 0.0);
        }

        // 手续费计算
        let fee_amount = (total_pool as f64 * fee_rate as f64) / 10000.0;
        let actual_pool = total_pool as f64 - fee_amount;

        let odds_a = if self.total_option_a > 0 {
            actual_pool / self.total_option_a as f64
        } else {
            0.0
        };

        let odds_b = if self.total_option_b > 0 {
            actual_pool / self.total_option_b as f64
        } else {
            0.0
        };

        (odds_a, odds_b)
    }
}
```

### 3. Solana 程序客户端 (src/solana/program.rs)

```rust
use anchor_client::{
    solana_sdk::{
        commitment_config::CommitmentConfig,
        pubkey::Pubkey,
        signature::{Keypair, Signer},
    },
    Client, Cluster, Program,
};
use anyhow::Result;
use std::rc::Rc;

pub struct PredictionMarketProgram {
    pub program: Program<Rc<Keypair>>,
    pub program_id: Pubkey,
}

impl PredictionMarketProgram {
    pub fn new(
        rpc_url: &str,
        program_id: Pubkey,
        payer: Keypair,
    ) -> Result<Self> {
        let payer_rc = Rc::new(payer);
        let client = Client::new_with_options(
            Cluster::Custom(rpc_url.to_string(), rpc_url.to_string()),
            payer_rc.clone(),
            CommitmentConfig::confirmed(),
        );

        let program = client.program(program_id)?;

        Ok(Self {
            program,
            program_id,
        })
    }

    /// 获取 Platform PDA
    pub fn get_platform_pda(&self) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"platform"], &self.program_id)
    }

    /// 获取 Market PDA
    pub fn get_market_pda(&self, market_id: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"market", &market_id.to_le_bytes()],
            &self.program_id,
        )
    }

    /// 获取 Vault PDA
    pub fn get_vault_pda(&self, market: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"vault", market.as_ref()], &self.program_id)
    }

    /// 获取 UserPosition PDA
    pub fn get_position_pda(&self, user: &Pubkey, market: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"position", user.as_ref(), market.as_ref()],
            &self.program_id,
        )
    }
}
```

### 4. 事件监听器 (src/solana/event_listener.rs)

```rust
use crate::{db::postgres::PgPool, models::market::Market, solana::program::PredictionMarketProgram};
use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anyhow::Result;
use futures::StreamExt;
use solana_client::{
    nonblocking::pubsub_client::PubsubClient,
    rpc_config::RpcTransactionLogsConfig,
    rpc_config::RpcTransactionLogsFilter,
};
use tracing::{error, info};

pub struct EventListener {
    ws_url: String,
    program: PredictionMarketProgram,
    db_pool: PgPool,
}

impl EventListener {
    pub fn new(
        ws_url: String,
        program: PredictionMarketProgram,
        db_pool: PgPool,
    ) -> Self {
        Self {
            ws_url,
            program,
            db_pool,
        }
    }

    /// 启动事件监听
    pub async fn start(&self) -> Result<()> {
        info!("Starting Solana event listener...");

        let pubsub_client = PubsubClient::new(&self.ws_url).await?;

        let config = RpcTransactionLogsConfig {
            commitment: Some(CommitmentConfig::confirmed()),
        };

        // 订阅程序日志
        let (mut logs_stream, _unsubscribe) = pubsub_client
            .logs_subscribe(
                RpcTransactionLogsFilter::Mentions(vec![self.program.program_id.to_string()]),
                config,
            )
            .await?;

        info!("Event listener started successfully");

        // 监听日志流
        while let Some(response) = logs_stream.next().await {
            match response.value.logs {
                Some(logs) => {
                    self.process_logs(logs).await;
                }
                None => {
                    error!("Received transaction with no logs");
                }
            }
        }

        Ok(())
    }

    async fn process_logs(&self, logs: Vec<String>) {
        for log in logs {
            // 解析事件日志
            if log.contains("MarketCreated") {
                self.handle_market_created(&log).await;
            } else if log.contains("BetPlaced") {
                self.handle_bet_placed(&log).await;
            } else if log.contains("MarketSettled") {
                self.handle_market_settled(&log).await;
            } else if log.contains("Withdrawn") {
                self.handle_withdrawn(&log).await;
            }
        }
    }

    async fn handle_market_created(&self, log: &str) {
        // 解析日志并保存到数据库
        info!("MarketCreated event: {}", log);
        // TODO: 实现日志解析和数据库写入
    }

    async fn handle_bet_placed(&self, log: &str) {
        info!("BetPlaced event: {}", log);
        // TODO: 实现日志解析和数据库写入
    }

    async fn handle_market_settled(&self, log: &str) {
        info!("MarketSettled event: {}", log);
        // TODO: 实现日志解析和数据库写入
    }

    async fn handle_withdrawn(&self, log: &str) {
        info!("Withdrawn event: {}", log);
        // TODO: 实现日志解析和数据库写入
    }
}
```

### 5. REST API (src/api/markets.rs)

```rust
use actix_web::{get, post, web, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use crate::{
    db::postgres::PgPool,
    models::market::{Market, MarketStatus, MarketWithOdds},
    services::odds::OddsService,
};

#[derive(Deserialize)]
pub struct MarketsQuery {
    pub status: Option<MarketStatus>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct MarketsResponse {
    pub data: Vec<MarketWithOdds>,
    pub pagination: Pagination,
}

#[derive(Serialize)]
pub struct Pagination {
    pub page: i64,
    pub limit: i64,
    pub total: i64,
}

/// GET /api/markets
#[get("/api/markets")]
pub async fn get_markets(
    pool: web::Data<PgPool>,
    odds_service: web::Data<OddsService>,
    query: web::Query<MarketsQuery>,
) -> Result<HttpResponse> {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);
    let offset = (page - 1) * limit;

    // 查询数据库
    let markets = if let Some(status) = &query.status {
        sqlx::query_as::<_, Market>(
            "SELECT * FROM markets WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
        )
        .bind(status)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?
    } else {
        sqlx::query_as::<_, Market>(
            "SELECT * FROM markets ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?
    };

    // 获取总数
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM markets")
        .fetch_one(pool.get_ref())
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    // 添加赔率信息
    let mut markets_with_odds = Vec::new();
    for market in markets {
        let (odds_a, odds_b) = odds_service.get_odds(&market.market_id).await
            .unwrap_or((0.0, 0.0));

        markets_with_odds.push(MarketWithOdds {
            market,
            odds_a,
            odds_b,
        });
    }

    Ok(HttpResponse::Ok().json(MarketsResponse {
        data: markets_with_odds,
        pagination: Pagination {
            page,
            limit,
            total: total.0,
        },
    }))
}

/// GET /api/markets/:market_id
#[get("/api/markets/{market_id}")]
pub async fn get_market(
    pool: web::Data<PgPool>,
    odds_service: web::Data<OddsService>,
    market_id: web::Path<String>,
) -> Result<HttpResponse> {
    let market = sqlx::query_as::<_, Market>(
        "SELECT * FROM markets WHERE market_id = $1"
    )
    .bind(market_id.as_str())
    .fetch_one(pool.get_ref())
    .await
    .map_err(actix_web::error::ErrorNotFound)?;

    let (odds_a, odds_b) = odds_service.get_odds(&market.market_id).await
        .unwrap_or((0.0, 0.0));

    Ok(HttpResponse::Ok().json(MarketWithOdds {
        market,
        odds_a,
        odds_b,
    }))
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(get_markets)
       .service(get_market);
}
```

### 6. WebSocket 处理器 (src/ws/handler.rs)

```rust
use actix::{Actor, AsyncContext, StreamHandler};
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_ws::{Message, Session};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{error, info};

#[derive(Deserialize)]
pub struct WsMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub channel: Option<String>,
}

#[derive(Serialize)]
pub struct WsResponse {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub channel: Option<String>,
    pub data: Option<serde_json::Value>,
}

pub struct WsConnection {
    session: Session,
}

impl WsConnection {
    pub fn new(session: Session) -> Self {
        Self { session }
    }

    fn handle_subscribe(&mut self, channel: &str) {
        info!("Client subscribed to {}", channel);

        let response = WsResponse {
            msg_type: "subscribed".to_string(),
            channel: Some(channel.to_string()),
            data: None,
        };

        if let Ok(json) = serde_json::to_string(&response) {
            let _ = self.session.text(json);
        }
    }

    fn handle_unsubscribe(&mut self, channel: &str) {
        info!("Client unsubscribed from {}", channel);

        let response = WsResponse {
            msg_type: "unsubscribed".to_string(),
            channel: Some(channel.to_string()),
            data: None,
        };

        if let Ok(json) = serde_json::to_string(&response) {
            let _ = self.session.text(json);
        }
    }
}

impl Actor for WsConnection {
    type Context = actix_ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        info!("WebSocket connection established");

        // 启动心跳
        ctx.run_interval(Duration::from_secs(30), |act, ctx| {
            ctx.ping(b"");
        });
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        info!("WebSocket connection closed");
    }
}

impl StreamHandler<Result<Message, actix_ws::ProtocolError>> for WsConnection {
    fn handle(&mut self, msg: Result<Message, actix_ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                    match ws_msg.msg_type.as_str() {
                        "subscribe" => {
                            if let Some(channel) = ws_msg.channel {
                                self.handle_subscribe(&channel);
                            }
                        }
                        "unsubscribe" => {
                            if let Some(channel) = ws_msg.channel {
                                self.handle_unsubscribe(&channel);
                            }
                        }
                        _ => {
                            error!("Unknown message type: {}", ws_msg.msg_type);
                        }
                    }
                }
            }
            Ok(Message::Ping(msg)) => {
                ctx.pong(&msg);
            }
            Ok(Message::Pong(_)) => {}
            Ok(Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            Ok(_) => {}
            Err(e) => {
                error!("WebSocket error: {:?}", e);
                ctx.stop();
            }
        }
    }
}

/// WebSocket 路由处理器
pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
) -> Result<HttpResponse, Error> {
    let (response, session, stream) = actix_ws::handle(&req, stream)?;

    let ws_connection = WsConnection::new(session);
    actix_rt::spawn(async move {
        let _ = stream.run(|msg| async move {
            match msg {
                Ok(m) => ws_connection.handle(Ok(m), &mut actix_ws::WebsocketContext::new()),
                Err(e) => ws_connection.handle(Err(e), &mut actix_ws::WebsocketContext::new()),
            }
            Ok(())
        }).await;
    });

    Ok(response)
}
```

---

## API 设计

### RESTful Endpoints

与 TypeScript 版本完全一致的 API 设计，详见 BACKEND_ARCHITECTURE.md 第 103-242 行。

---

## 链上事件监听

### 优化的事件解析策略

```rust
use anchor_client::anchor_lang::Event;
use serde::Deserialize;

/// Anchor 事件解析器
pub struct EventParser;

impl EventParser {
    /// 从日志中解析 Anchor 事件
    pub fn parse_anchor_event<T: Event + for<'de> Deserialize<'de>>(
        log: &str,
    ) -> Option<T> {
        // Anchor 事件格式: "Program log: EVENT_NAME: {json}"
        if let Some(event_data) = log.strip_prefix("Program log: ") {
            if let Some(json_start) = event_data.find('{') {
                let json = &event_data[json_start..];
                return serde_json::from_str(json).ok();
            }
        }
        None
    }
}
```

---

## 实时赔率服务

### Rust + Redis 实现

```rust
use redis::{aio::ConnectionManager, AsyncCommands};
use anyhow::Result;

pub struct OddsService {
    redis: ConnectionManager,
    fee_rate: u16,
}

impl OddsService {
    pub fn new(redis: ConnectionManager, fee_rate: u16) -> Self {
        Self { redis, fee_rate }
    }

    /// 计算并缓存赔率
    pub async fn calculate_and_cache_odds(
        &self,
        market: &Market,
    ) -> Result<(f64, f64)> {
        let (odds_a, odds_b) = market.calculate_odds(self.fee_rate);

        // 缓存到 Redis (TTL 5 秒)
        let cache_key = format!("odds:{}", market.market_id);
        let cache_value = serde_json::json!({
            "odds_a": odds_a,
            "odds_b": odds_b,
            "timestamp": chrono::Utc::now().timestamp()
        });

        let mut conn = self.redis.clone();
        conn.set_ex(
            &cache_key,
            cache_value.to_string(),
            5, // TTL 5 seconds
        ).await?;

        Ok((odds_a, odds_b))
    }

    /// 获取赔率（先从缓存）
    pub async fn get_odds(&self, market_id: &str) -> Result<(f64, f64)> {
        let cache_key = format!("odds:{}", market_id);

        let mut conn = self.redis.clone();
        let cached: Option<String> = conn.get(&cache_key).await?;

        if let Some(json) = cached {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json) {
                let odds_a = value["odds_a"].as_f64().unwrap_or(0.0);
                let odds_b = value["odds_b"].as_f64().unwrap_or(0.0);
                return Ok((odds_a, odds_b));
            }
        }

        // 缓存未命中，从数据库计算
        Ok((0.0, 0.0)) // TODO: 从数据库获取市场数据并计算
    }
}
```

---

## 数据库设计

### SQLx Migration

**migrations/20250104_init.sql**:

```sql
-- 与 BACKEND_ARCHITECTURE.md 完全一致的数据库 Schema
-- 详见 863-946 行

CREATE TABLE markets (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(20) UNIQUE NOT NULL,
  authority VARCHAR(44) NOT NULL,
  vault VARCHAR(44) NOT NULL,
  usdc_mint VARCHAR(44) NOT NULL,
  option_a_name VARCHAR(100) NOT NULL,
  option_b_name VARCHAR(100) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL,
  winning_option SMALLINT,
  total_option_a BIGINT DEFAULT 0,
  total_option_b BIGINT DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP
);

CREATE INDEX idx_market_id ON markets(market_id);
CREATE INDEX idx_status ON markets(status);
CREATE INDEX idx_end_time ON markets(end_time);

-- 其他表结构同 TypeScript 版本
```

---

## 部署配置

### Dockerfile

```dockerfile
# 多阶段构建
FROM rust:1.75 as builder

WORKDIR /app

# 复制 Cargo 文件
COPY Cargo.toml Cargo.lock ./

# 预构建依赖（缓存优化）
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# 复制源代码
COPY . .

# 构建应用
RUN cargo build --release

# 运行阶段
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 从构建器复制二进制文件
COPY --from=builder /app/target/release/prediction-market-backend ./

# 运行
EXPOSE 3000 3001
CMD ["./prediction-market-backend"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: prediction_market
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: .
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/prediction_market
      REDIS_URL: redis://redis:6379
      SOLANA_RPC_URL: ${SOLANA_RPC_URL}
      SOLANA_WS_URL: ${SOLANA_WS_URL}
      PROGRAM_ID: ${PROGRAM_ID}
    ports:
      - "3000:3000"
      - "3001:3001"
    volumes:
      - ./config:/app/config
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## 🚀 开发与部署

### 本地开发

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 克隆项目
git clone <repo>
cd prediction-market-backend

# 启动数据库
docker-compose up -d postgres redis

# 运行迁移
sqlx migrate run

# 运行开发服务器
cargo run

# 运行测试
cargo test
```

### 生产部署

```bash
# 构建 Release 版本
cargo build --release

# Docker 部署
docker-compose up -d

# 查看日志
docker-compose logs -f backend
```

---

## 📊 性能优势

### Rust vs TypeScript

```yaml
性能对比:
  内存使用: Rust < 1/3 TypeScript (无 GC)
  并发能力: Rust 可支持 100K+ WebSocket 连接
  启动时间: Rust < 100ms (编译后二进制)
  CPU 使用: Rust 约为 TypeScript 的 1/2

生产环境优势:
  - 更低的服务器成本
  - 更高的并发性能
  - 更好的内存可预测性
  - 更少的运行时错误
```

---

**文档版本**: v1.0
**状态**: Rust 后端完整架构设计
**作者**: PM Agent + Claude Code
**最后更新**: 2025-11-04
