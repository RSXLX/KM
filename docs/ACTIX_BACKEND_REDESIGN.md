# KMarket后端架构重新设计文档 (Actix-Web)

---

## 📋 目录

1. [设计变更概述](#1-设计变更概述)
2. [简化架构设计](#2-简化架构设计)
3. [Actix-Web最佳实践应用](#3-actix-web最佳实践应用)
4. [核心模块重新设计](#4-核心模块重新设计)
5. [智能合约集成优化](#5-智能合约集成优化)
6. [项目结构优化](#6-项目结构优化)
7. [完整代码示例](#7-完整代码示例)
8. [性能优化策略](#8-性能优化策略)
9. [开发计划调整](#9-开发计划调整)

```
┌─────────────────────────────────────┐
│      HTTP Handlers (Actix-Web)      │
│  - 路由处理                          │
│  - 参数验证                          │
│  - 直接操作Repository                │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      Repository Layer (3个模块)      │
│  - MarketRepository                 │
│  - OrderRepository                  │
│  - CacheManager (Redis)             │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      Data + External Layer           │
│  - PostgreSQL (数据持久化)           │
│  - Redis (缓存)                      │
│  - BSC RPC (链上查询)                │
└─────────────────────────────────────┘

优势:
- 层次精简 (2层架构 vs 原3层)
- 代码量减少 37% (5200行 vs 8500行)
- 业务逻辑清晰 (Handler直接操作Repository)
- MVP聚焦核心功能
```
### 1.4 保留的核心功能

| 功能 | 优先级 | 保留理由 |
|------|-------|---------|
| **WebSocket实时推送** | 🔴 高 | 核心竞争力,用户体验关键 |
| **EventListener (链上事件监听)** | 🔴 高 | 链上链下数据同步关键 |
| **批量操作 (Batch APIs)** | 🟡 中 | 优化Gas消耗,提升效率 |
| **Redis缓存** | 🟡 中 | 降低数据库压力,提升响应速度 |
| **CORS/压缩中间件** | 🟢 低 | Actix-Web内置,开箱即用 |

---

## 2. 简化架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       前端层                                 │
│  Next.js + wagmi + WebSocket Client                          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Actix-Web HTTP层                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ HTTP Handlers│  │ WebSocket    │  │ Middleware   │      │
│  │ (路由处理)    │  │ Actor        │  │ (CORS/Log)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                  │                                 │
│  ┌──────┴──────────────────┴──────────────────┐             │
│  │           Repository Layer                  │             │
│  │  - MarketRepository (市场查询)              │             │
│  │  - OrderRepository (订单查询)               │             │
│  │  - CacheManager (Redis缓存)                │             │
│  └─────────────────────┬───────────────────────┘             │
│                        │                                      │
│  ┌─────────────────────┴───────────────────────────────┐     │
│  │              Data + External Layer                   │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │     │
│  │  │PostgreSQL│  │  Redis   │  │ BSC (ethers-rs)  │  │     │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Background Tasks (Actor)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌────────────────────────────┐   │
│  │ EventListener Actor  │  │ WebSocket Broadcaster      │   │
│  │ (监听链上事件)        │  │ (消息广播管理)              │   │
│  └──────────────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 请求处理流程

#### 2.2.1 标准API请求

```
┌─────────────────┐
│ User Request    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Middleware Stack                │
│ 1. CORS验证                      │
│ 2. 请求日志                      │
│ 3. 错误处理                      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ HTTP Handler                    │
│ - 解析请求参数                   │
│ - 验证输入                       │
│ - 调用Repository                │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Repository Layer                │
│ 1. 检查Redis缓存                 │
│ 2. 查询PostgreSQL (如果缓存未命中)│
│ 3. 更新缓存                      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 统一JSON响应                     │
│ {                                │
│   "success": true,               │
│   "data": {...},                 │
│   "timestamp": 1704528000        │
│ }                                │
└──────────────────────────────────┘
```

#### 2.2.2 WebSocket消息推送

```
Smart Contract Event
    │
    ▼
EventListener Actor
    │ 1. 解析事件
    │ 2. 更新数据库
    │ 3. 清除缓存
    │
    ▼
Broadcaster Actor
    │
    ├─→ WsSession#1 → Client#1
    ├─→ WsSession#2 → Client#2
    └─→ WsSession#N → Client#N
```

### 2.3 数据流设计

```
┌─────────────────────────────────────────────────────────────┐
│                     数据一致性保证                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Smart Contract (链上 - 唯一真实数据源)                      │
│       │                                                      │
│       ├─ Events → EventListener → PostgreSQL (链下副本)     │
│       │            │                                         │
│       │            └─→ Redis缓存清除                        │
│       │            └─→ WebSocket广播                        │
│       │                                                      │
│       └─ View Functions → API直接查询 (实时数据)            │
│                                                              │
│  查询优先级:                                                 │
│  1. Redis缓存 (TTL 5分钟) - 最快                           │
│  2. PostgreSQL (链下副本) - 支持复杂查询                   │
│  3. Smart Contract (链上) - 最权威但慢                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Actix-Web最佳实践应用

### 3.1 状态管理 (AppState)

```rust
// src/state.rs
use actix::Addr;
use sqlx::PgPool;
use redis::aio::ConnectionManager;
use std::sync::Arc;

/// 全局应用状态 (线程安全)
#[derive(Clone)]
pub struct AppState {
    /// PostgreSQL连接池
    pub db_pool: PgPool,

    /// Redis连接管理器
    pub redis: ConnectionManager,

    /// Web3客户端 (Arc共享)
    pub web3_client: Arc<crate::web3::Web3Client>,

    /// WebSocket广播器地址 (Actor通信)
    pub ws_broadcaster: Addr<crate::websocket::Broadcaster>,
}

impl AppState {
    /// 初始化应用状态
    pub async fn new() -> anyhow::Result<Self> {
        // 数据库连接池
        let db_pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(10)
            .min_connections(2)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .connect(&std::env::var("DATABASE_URL")?)
            .await?;

        // Redis连接
        let redis_client = redis::Client::open(std::env::var("REDIS_URL")?)?;
        let redis = ConnectionManager::new(redis_client).await?;

        // Web3客户端
        let web3_client = Arc::new(crate::web3::Web3Client::new().await?);

        // 启动WebSocket广播器Actor
        let ws_broadcaster = crate::websocket::Broadcaster::new().start();

        Ok(Self {
            db_pool,
            redis,
            web3_client,
            ws_broadcaster,
        })
    }
}
```

### 3.2 中间件配置

```rust
// src/main.rs 中间件配置
use actix_web::{App, middleware};
use actix_cors::Cors;

App::new()
    .app_data(web::Data::new(app_state.clone()))

    // CORS中间件 (开箱即用)
    .wrap(
        Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600)
    )

    // 日志中间件
    .wrap(middleware::Logger::default())

    // 压缩中间件 (gzip/br/deflate)
    .wrap(middleware::Compress::default())

    // 自定义错误处理中间件
    .wrap(crate::middleware::ErrorHandler)
```

### 3.3 WebSocket Actor模式

```rust
// src/websocket/server.rs
use actix::prelude::*;
use actix_web_actors::ws;

/// WebSocket会话Actor
pub struct WsSession {
    id: usize,
    broadcaster: Addr<Broadcaster>,
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    /// Actor启动时注册到广播器
    fn started(&mut self, ctx: &mut Self::Context) {
        let addr = ctx.address();

        self.broadcaster
            .send(Connect { addr: addr.recipient() })
            .into_actor(self)
            .then(|res, act, _ctx| {
                if let Ok(id) = res {
                    act.id = id;
                    tracing::info!("WebSocket session {} connected", id);
                }
                fut::ready(())
            })
            .wait(ctx);
    }

    /// Actor停止时从广播器注销
    fn stopping(&mut self, _ctx: &mut Self::Context) -> Running {
        self.broadcaster.do_send(Disconnect { id: self.id });
        tracing::info!("WebSocket session {} disconnected", self.id);
        Running::Stop
    }
}

/// 处理WebSocket消息
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                tracing::debug!("Received text: {}", text);
                // 可以处理客户端订阅消息
            }
            Ok(ws::Message::Close(reason)) => ctx.close(reason),
            _ => {}
        }
    }
}

/// 接收广播消息并发送给客户端
impl Handler<WsMessage> for WsSession {
    type Result = ();

    fn handle(&mut self, msg: WsMessage, ctx: &mut Self::Context) {
        let json = serde_json::to_string(&msg).unwrap();
        ctx.text(json);
    }
}
```

---

## 4. 核心模块重新设计

### 4.1 Repository模式

#### 4.1.1 MarketRepository

```rust
// src/repository/market_repo.rs
use sqlx::PgPool;
use anyhow::Result;
use crate::models::{Market, MarketStatus};

pub struct MarketRepository {
    db_pool: PgPool,
}

impl MarketRepository {
    pub fn new(db_pool: PgPool) -> Self {
        Self { db_pool }
    }

    /// 获取活跃市场列表 (支持分页)
    pub async fn get_active_markets(
        &self,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Market>> {
        let markets = sqlx::query_as!(
            Market,
            r#"
            SELECT
                id, market_id, title, description,
                option_a, option_b, start_time, end_time,
                status as "status: _", winning_option, created_at
            FROM markets
            WHERE status = 'active'
            AND end_time > NOW()
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            "#,
            limit,
            offset
        )
        .fetch_all(&self.db_pool)
        .await?;

        Ok(markets)
    }

    /// 根据market_id查询市场详情
    pub async fn find_by_market_id(&self, market_id: i64) -> Result<Option<Market>> {
        let market = sqlx::query_as!(
            Market,
            r#"
            SELECT
                id, market_id, title, description,
                option_a, option_b, start_time, end_time,
                status as "status: _", winning_option, created_at
            FROM markets
            WHERE market_id = $1
            "#,
            market_id
        )
        .fetch_optional(&self.db_pool)
        .await?;

        Ok(market)
    }

    /// 获取市场统计数据
    pub async fn get_market_stats(&self, market_id: i64) -> Result<MarketStats> {
        let stats = sqlx::query_as!(
            MarketStats,
            r#"
            SELECT
                COUNT(*) FILTER (WHERE option = 0) as "bets_a!",
                COUNT(*) FILTER (WHERE option = 1) as "bets_b!",
                COALESCE(SUM(amount) FILTER (WHERE option = 0), 0)::TEXT as "amount_a!",
                COALESCE(SUM(amount) FILTER (WHERE option = 1), 0)::TEXT as "amount_b!",
                COUNT(*) as "total_orders!"
            FROM orders
            WHERE market_id = $1
            "#,
            market_id
        )
        .fetch_one(&self.db_pool)
        .await?;

        Ok(stats)
    }

    /// 创建市场 (管理员)
    pub async fn create(&self, req: CreateMarketRequest) -> Result<Market> {
        let market = sqlx::query_as!(
            Market,
            r#"
            INSERT INTO markets (
                market_id, title, description, option_a, option_b,
                start_time, end_time, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING
                id, market_id, title, description,
                option_a, option_b, start_time, end_time,
                status as "status: _", winning_option, created_at
            "#,
            req.market_id,
            req.title,
            req.description,
            req.option_a,
            req.option_b,
            req.start_time,
            req.end_time
        )
        .fetch_one(&self.db_pool)
        .await?;

        Ok(market)
    }
}

#[derive(Debug, serde::Serialize)]
pub struct MarketStats {
    pub bets_a: i64,
    pub bets_b: i64,
    pub amount_a: String,
    pub amount_b: String,
    pub total_orders: i64,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateMarketRequest {
    pub market_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub option_a: String,
    pub option_b: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
}
```

#### 4.1.2 CacheManager

```rust
// src/repository/cache.rs
use redis::aio::ConnectionManager;
use anyhow::Result;
use serde::{Serialize, de::DeserializeOwned};

pub struct CacheManager {
    redis: ConnectionManager,
}

impl CacheManager {
    pub fn new(redis: ConnectionManager) -> Self {
        Self { redis }
    }

    /// 获取缓存 (泛型支持)
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let cached: Option<String> = redis::cmd("GET")
            .arg(key)
            .query_async(&mut self.redis.clone())
            .await?;

        match cached {
            Some(json) => Ok(Some(serde_json::from_str(&json)?)),
            None => Ok(None),
        }
    }

    /// 设置缓存 (自动序列化)
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: usize) -> Result<()> {
        let json = serde_json::to_string(value)?;

        redis::cmd("SETEX")
            .arg(key)
            .arg(ttl)
            .arg(json)
            .query_async(&mut self.redis.clone())
            .await?;

        Ok(())
    }

    /// 删除缓存
    pub async fn delete(&self, key: &str) -> Result<()> {
        redis::cmd("DEL")
            .arg(key)
            .query_async(&mut self.redis.clone())
            .await?;

        Ok(())
    }
}

/// 缓存Key命名规范
pub mod cache_keys {
    pub fn market(market_id: i64) -> String {
        format!("market:{}", market_id)
    }

    pub fn market_stats(market_id: i64) -> String {
        format!("market_stats:{}", market_id)
    }

    pub fn user_orders(address: &str) -> String {
        format!("user_orders:{}", address)
    }

    pub fn active_markets() -> String {
        "markets:active".to_string()
    }
}
```

### 4.2 HTTP Handlers

```rust
// src/routes/markets.rs
use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use crate::state::AppState;
use crate::repository::{MarketRepository, cache};
use crate::utils::response::ApiResponse;

/// GET /api/v1/markets - 获取市场列表
pub async fn get_markets(
    state: web::Data<AppState>,
    query: web::Query<GetMarketsQuery>,
) -> Result<HttpResponse> {
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    // 1. 尝试从缓存获取
    let cache_key = cache::cache_keys::active_markets();
    let cache_mgr = cache::CacheManager::new(state.redis.clone());

    if let Ok(Some(markets)) = cache_mgr.get::<Vec<crate::models::Market>>(&cache_key).await {
        tracing::debug!("Cache hit for active markets");
        return Ok(HttpResponse::Ok().json(ApiResponse::success(markets)));
    }

    // 2. 从数据库查询
    let repo = MarketRepository::new(state.db_pool.clone());
    let markets = repo.get_active_markets(page_size, offset).await
        .map_err(|e| {
            tracing::error!("Failed to get markets: {}", e);
            actix_web::error::ErrorInternalServerError(e)
        })?;

    // 3. 更新缓存 (TTL 5分钟)
    let _ = cache_mgr.set(&cache_key, &markets, 300).await;

    Ok(HttpResponse::Ok().json(ApiResponse::success(markets)))
}

/// GET /api/v1/markets/:id - 获取市场详情
pub async fn get_market_detail(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> Result<HttpResponse> {
    let market_id = path.into_inner();

    let repo = MarketRepository::new(state.db_pool.clone());
    let market = repo.find_by_market_id(market_id).await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?
        .ok_or_else(|| actix_web::error::ErrorNotFound("Market not found"))?;

    Ok(HttpResponse::Ok().json(ApiResponse::success(market)))
}

/// GET /api/v1/markets/:id/stats - 获取市场统计
pub async fn get_market_stats(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> Result<HttpResponse> {
    let market_id = path.into_inner();

    // 1. 尝试缓存 (TTL 1分钟,统计数据变化快)
    let cache_key = cache::cache_keys::market_stats(market_id);
    let cache_mgr = cache::CacheManager::new(state.redis.clone());

    if let Ok(Some(stats)) = cache_mgr.get(&cache_key).await {
        return Ok(HttpResponse::Ok().json(ApiResponse::success(stats)));
    }

    // 2. 查询数据库
    let repo = MarketRepository::new(state.db_pool.clone());
    let stats = repo.get_market_stats(market_id).await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    // 3. 更新缓存
    let _ = cache_mgr.set(&cache_key, &stats, 60).await;

    Ok(HttpResponse::Ok().json(ApiResponse::success(stats)))
}

#[derive(Deserialize)]
pub struct GetMarketsQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}
```

---

## 5. 智能合约集成优化

### 5.1 Web3Client封装

```rust
// src/web3/client.rs
use ethers::prelude::*;
use std::sync::Arc;
use anyhow::Result;

/// Web3客户端封装
pub struct Web3Client {
    provider: Arc<Provider<Ws>>,
    prediction_market_addr: Address,
    kmark_token_addr: Address,
}

impl Web3Client {
    /// 初始化Web3客户端
    pub async fn new() -> Result<Self> {
        let rpc_url = std::env::var("BSC_RPC_URL")?;
        let provider = Provider::<Ws>::connect(&rpc_url).await?;

        Ok(Self {
            provider: Arc::new(provider),
            prediction_market_addr: std::env::var("PREDICTION_MARKET_ADDRESS")?.parse()?,
            kmark_token_addr: std::env::var("KMARK_TOKEN_ADDRESS")?.parse()?,
        })
    }

    /// 获取当前区块号
    pub async fn get_block_number(&self) -> Result<U64> {
        let block_number = self.provider.get_block_number().await?;
        Ok(block_number)
    }

    /// 获取市场信息 (链上查询)
    pub async fn get_market(&self, market_id: U256) -> Result<MarketData> {
        // 调用合约的getMarket()函数
        // 实现略,参考CONTRACT_DETAILED_DESIGN.md
        todo!()
    }
}
```

### 5.2 EventListener Actor

```rust
// src/web3/event_listener.rs
use actix::prelude::*;
use ethers::prelude::*;
use sqlx::PgPool;
use std::sync::Arc;

/// 事件监听Actor (后台任务)
pub struct EventListener {
    web3_client: Arc<crate::web3::Web3Client>,
    db_pool: PgPool,
    ws_broadcaster: Addr<crate::websocket::Broadcaster>,
}

impl Actor for EventListener {
    type Context = Context<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        tracing::info!("EventListener Actor started");

        // 启动事件监听循环
        ctx.spawn(
            self.listen_events()
                .into_actor(self)
                .map(|res, _act, _ctx| {
                    if let Err(e) = res {
                        tracing::error!("Event listener error: {}", e);
                    }
                })
        );
    }
}

impl EventListener {
    pub fn new(
        web3_client: Arc<crate::web3::Web3Client>,
        db_pool: PgPool,
        ws_broadcaster: Addr<crate::websocket::Broadcaster>,
    ) -> Self {
        Self {
            web3_client,
            db_pool,
            ws_broadcaster,
        }
    }

    /// 监听链上事件
    async fn listen_events(&self) -> anyhow::Result<()> {
        // 1. 监听BetPlaced事件
        // 2. 监听MarketSettled事件
        // 3. 监听RewardClaimed事件

        // 示例: 监听BetPlaced
        // let filter = self.web3_client.prediction_market.event::<BetPlacedFilter>();
        // let mut stream = filter.stream().await?;

        // while let Some(log) = stream.next().await {
        //     self.handle_bet_placed(log?).await?;
        // }

        Ok(())
    }

    /// 处理BetPlaced事件
    async fn handle_bet_placed(&self, event: BetPlacedFilter) -> anyhow::Result<()> {
        tracing::info!("BetPlaced: order_id={}, user={:?}", event.order_id, event.user);

        // 1. 保存订单到数据库
        // 2. 清除相关缓存
        // 3. WebSocket广播

        Ok(())
    }
}

// 合约事件类型 (从ABI生成)
#[derive(Debug, Clone)]
pub struct BetPlacedFilter {
    pub order_id: U256,
    pub user: Address,
    pub market_id: U256,
    pub amount: U256,
    pub odds: U256,
    pub option: u8,
}
```

---

## 6. 项目结构优化

### 6.1 目录结构

```
kmarket-backend/
├── Cargo.toml                    # 依赖配置
├── Cargo.lock
├── .env.example                  # 环境变量模板
├── .env                          # gitignored
├── README.md
├── src/
│   ├── main.rs                   # 🚀 应用入口 (150行)
│   ├── state.rs                  # 🌍 全局状态 (100行)
│   │
│   ├── routes/                   # 📡 HTTP路由 (1200行)
│   │   ├── mod.rs
│   │   ├── markets.rs            # 市场路由
│   │   ├── orders.rs             # 订单路由
│   │   ├── users.rs              # 用户路由
│   │   ├── admin.rs              # 管理路由
│   │   └── health.rs             # 健康检查
│   │
│   ├── repository/               # 💾 数据访问 (800行)
│   │   ├── mod.rs
│   │   ├── market_repo.rs
│   │   ├── order_repo.rs
│   │   ├── user_repo.rs
│   │   └── cache.rs              # Redis封装
│   │
│   ├── models/                   # 📦 数据模型 (400行)
│   │   ├── mod.rs
│   │   ├── market.rs
│   │   ├── order.rs
│   │   └── user.rs
│   │
│   ├── web3/                     # ⛓️ Web3集成 (900行)
│   │   ├── mod.rs
│   │   ├── client.rs             # Web3客户端
│   │   ├── contracts.rs          # 合约交互
│   │   ├── event_listener.rs     # 事件监听Actor
│   │   └── types.rs              # 类型转换
│   │
│   ├── websocket/                # 🔌 WebSocket (600行)
│   │   ├── mod.rs
│   │   ├── server.rs             # WsSession Actor
│   │   ├── broadcaster.rs        # Broadcaster Actor
│   │   └── messages.rs           # 消息类型
│   │
│   ├── middleware/               # 🛡️ 中间件 (300行)
│   │   ├── mod.rs
│   │   └── error.rs              # 错误处理
│   │
│   └── utils/                    # 🔧 工具 (400行)
│       ├── mod.rs
│       ├── errors.rs             # 错误类型
│       ├── response.rs           # 响应格式
│       └── validation.rs         # 输入验证
│
├── tests/                        # 🧪 集成测试
│   ├── api_tests.rs
│   ├── websocket_tests.rs
│   └── common/
│       └── helpers.rs
│
└── docs/                         # 📚 文档
    └── API.md
```

**总计**: ~5200行 (vs 原设计8500行, -37%)

### 6.2 Cargo.toml依赖

```toml
[package]
name = "kmarket-backend"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"

[dependencies]
# Web框架
actix-web = "4.4"
actix-web-actors = "4.2"  # WebSocket
actix = "0.13"            # Actor系统
actix-cors = "0.7"
actix-files = "0.6"       # 可选

# 异步运行时
tokio = { version = "1.35", features = ["full"] }

# 序列化
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# 数据库
sqlx = { version = "0.7", features = [
    "postgres",
    "runtime-tokio-native-tls",
    "chrono",
    "uuid"
] }
redis = { version = "0.24", features = ["tokio-comp", "connection-manager"] }

# Web3
ethers = { version = "2.0", features = ["ws", "rustls"] }

# 日志
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-actix-web = "0.7"

# 其他
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1.0"
thiserror = "1.0"
dotenv = "0.15"
hex = "0.4"
uuid = { version = "1.6", features = ["v4", "serde"] }

[dev-dependencies]
actix-rt = "2.9"
```

---

## 7. 完整代码示例

### 7.1 main.rs (应用入口)

```rust
// src/main.rs
use actix_web::{web, App, HttpServer, middleware};
use actix_cors::Cors;
use tracing_subscriber;

mod state;
mod routes;
mod repository;
mod models;
mod web3;
mod websocket;
mod middleware as custom_middleware;
mod utils;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // 1. 加载环境变量
    dotenv::dotenv().ok();

    // 2. 初始化日志
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into())
        )
        .init();

    tracing::info!("Starting KMarket Backend Server...");

    // 3. 初始化应用状态
    let app_state = state::AppState::new()
        .await
        .expect("Failed to initialize AppState");

    // 4. 启动EventListener Actor
    let event_listener = web3::event_listener::EventListener::new(
        app_state.web3_client.clone(),
        app_state.db_pool.clone(),
        app_state.ws_broadcaster.clone(),
    );
    event_listener.start();

    // 5. 启动HTTP服务器
    let server_addr = std::env::var("SERVER_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:3000".to_string());

    tracing::info!("Server listening on http://{}", server_addr);

    HttpServer::new(move || {
        // CORS配置
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .app_data(web::Data::new(app_state.clone()))

            // 中间件
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())

            // API路由
            .service(
                web::scope("/api/v1")
                    // 市场路由
                    .route("/markets", web::get().to(routes::markets::get_markets))
                    .route("/markets/{id}", web::get().to(routes::markets::get_market_detail))
                    .route("/markets/{id}/stats", web::get().to(routes::markets::get_market_stats))

                    // 订单路由
                    .route("/orders", web::post().to(routes::orders::create_order))
                    .route("/users/{address}/orders", web::get().to(routes::orders::get_user_orders))
                    .route("/users/{address}/stats", web::get().to(routes::orders::get_user_stats))

                    // 管理路由
                    .service(
                        web::scope("/admin")
                            .route("/markets", web::post().to(routes::admin::create_market))
                            .route("/markets/{id}/settle", web::put().to(routes::admin::settle_market))
                    )
            )

            // 健康检查
            .route("/health", web::get().to(routes::health::health_check))

            // WebSocket
            .route("/ws", web::get().to(websocket::ws_handler))
    })
    .bind(&server_addr)?
    .run()
    .await
}
```

### 7.2 统一响应格式

```rust
// src/utils/response.rs
use serde::Serialize;

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiError>,
    pub timestamp: i64,
}

#[derive(Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            timestamp: chrono::Utc::now().timestamp(),
        }
    }

    pub fn error(code: String, message: String) -> ApiResponse<()> {
        ApiResponse {
            success: false,
            data: None,
            error: Some(ApiError { code, message }),
            timestamp: chrono::Utc::now().timestamp(),
        }
    }
}
```

---

## 8. 性能优化策略

### 8.1 数据库优化

```rust
// 连接池配置
sqlx::postgres::PgPoolOptions::new()
    .max_connections(10)
    .min_connections(2)
    .acquire_timeout(Duration::from_secs(30))
    .idle_timeout(Duration::from_secs(600))
    .connect(&database_url)
    .await?
```

### 8.2 缓存策略

| 缓存Key | TTL | 用途 |
|---------|-----|------|
| `market:{id}` | 5分钟 | 市场详情 |
| `market_stats:{id}` | 1分钟 | 市场统计 |
| `markets:active` | 5分钟 | 活跃市场列表 |
| `user_orders:{address}` | 1分钟 | 用户订单 |

### 8.3 并发查询

```rust
// 使用tokio::try_join!并发查询
let (market, stats, orders) = tokio::try_join!(
    repo.find_by_market_id(market_id),
    repo.get_market_stats(market_id),
    order_repo.get_market_orders(market_id)
)?;
```

---

## 9. 开发计划调整

### 9.1 Week 1: 基础架构 (5天)

#### Day 1: 项目初始化
- [ ] 创建Rust项目
- [ ] 配置Cargo.toml
- [ ] 设置.env环境变量
- [ ] 编写main.rs基础结构

**验收**: `cargo run`成功启动

#### Day 2: 数据层
- [ ] 编写数据库
- [ ] 实现Repository层
- [ ] 实现CacheManager

**验收**: Repository测试通过

#### Day 3: HTTP API
- [ ] 实现市场路由
- [ ] 实现订单路由
- [ ] 实现健康检查

**验收**: API可访问

#### Day 4: Web3集成
- [ ] 实现Web3Client
- [ ] 实现合约查询

**验收**: 可查询链上数据

#### Day 5: 中间件和错误处理
- [ ] 统一错误处理
- [ ] 配置中间件

**验收**: 错误响应统一

### 9.2 Week 2: WebSocket和高级功能 (5天)

#### Day 6-7: WebSocket
- [ ] Broadcaster Actor
- [ ] WsSession Actor
- [ ] WebSocket测试

#### Day 8: EventListener
- [ ] 事件监听Actor
- [ ] 数据库同步
- [ ] WebSocket广播

#### Day 9: 管理API
- [ ] 创建市场API
- [ ] 结算市场API

#### Day 10: 集成测试
- [ ] 完整流程测试
- [ ] 性能测试

### 9.3 Week 3: 部署和优化 (5天)

#### Day 11-15: 部署和文档
- [ ] 测试网部署
- [ ] 文档编写
- [ ] 安全审查
- [ ] 性能调优

---

## 📌 总结


### 下一步

1. ✅ 设计方案确认
2. 🔄 开始Week 1 Day 1: 项目初始化
3. 🔄 准备测试环境

准备开始开发了吗? 🚀

**维护**: 技术团队
**最后更新**: 2025-11-06
