# Actix-Web 后端开发实施步骤（详细版）

本文以 `Actix-Web` 为后端框架，结合现有文档（BACKEND_TECH_STACK_AND_FEATURES、COMPLETE_DEVELOPMENT_PLAN、ADR 等），将每个阶段拆解为可执行的步骤与验收标准，确保端到端闭环（市场→赔率→投注→结算→同步）。

---

## 0. 概览与目标

- 技术栈：`Actix-Web`、`PostgreSQL + SQLx`、`Redis`、`ethers-rs`、`WebSocket (actix-web-actors/actix_ws)`、`JWT`
- 关键能力：实时赔率推送、链上投注、订单入库与结算同步、管理后台与风控、健康与观测
- 交付物：后端服务二进制、Docker 镜像、迁移脚本、配置文件、CI/CD 流水线

---

## 1. 环境准备与项目初始化

必做事项：
- 安装 Rust（stable）、`cargo`、`sqlx-cli`、PostgreSQL 15、Redis 7
- 新建后端项目与依赖声明

步骤：
1) 初始化项目与依赖
   - `cargo new kmarket-backend --bin`
   - `Cargo.toml` 增加依赖：
     ```toml
     [dependencies]
     actix-web = "4"
     actix-web-actors = "4" # 或 actix-ws = "0.2"
     actix-cors = "0.6"
     actix-governor = "0.5"
     serde = { version = "1", features = ["derive"] }
     serde_json = "1"
     sqlx = { version = "0.7", features = ["runtime-tokio", "postgres", "macros"] }
     redis = { version = "0.24", features = ["tokio-comp"] }
     ethers = "2"
     jsonwebtoken = "8"
     tracing = "0.1"
     tracing-subscriber = "0.3"
     dotenvy = "0.15"
     anyhow = "1"
     thiserror = "1"
     ```
2) 创建基础目录结构：
   - `src/config/`、`src/routes/`、`src/services/`、`src/websocket/`、`src/web3/`、`src/db/`、`src/utils/`
3) 准备 `.env`：`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`、`BSC_RPC_URL`、`CONTRACT_ADDR_*`

验收标准：项目可编译，`RUST_LOG=info` 启动，无 panic。

---

## 2. 配置模块与日志

必做事项：
- 集中环境变量加载与校验；统一日志初始化

步骤：
1) `src/config/mod.rs`：读取 `.env`，构建 `AppConfig`（DB/Redis/JWT/BSC）
2) 初始化日志：
   - `tracing_subscriber::fmt().with_env_filter("info").init();`

验收标准：缺失配置时报错退出；日志格式统一（时间、级别、traceId）。

---

## 3. Actix-Web 启动与中间件

必做事项：
- 启动 HTTP 服务，接入 CORS、日志、压缩、限流、超时（推荐）

步骤：
1) 在 `src/main.rs`：
   - `App::new()`
   - `.wrap(Logger::default())`
   - `.wrap(Compress::default())`
   - `.wrap(Cors::default().allowed_origin("https://kmarket.com").allowed_methods(vec!["GET","POST"]).allowed_headers(vec![http::header::CONTENT_TYPE, http::header::AUTHORIZATION]).supports_credentials())`
   - `.wrap(Governor::new(&GovernorConfigBuilder::default().per_second(10).burst_size(20).finish().unwrap()))`
   - 超时：使用 `actix-timeout` 或在 handler 内 `tokio::time::timeout` 包裹耗时操作
2) 注册基础路由：`/healthz`、`/readyz`

验收标准：CORS 生效；限流命中；压测下超时保护有效。

---

## 4. 健康与就绪探针

必做事项：
- 存活探针与依赖检查（DB/Redis/第三方赔率 API）

步骤：
1) `GET /healthz`：返回固定 OK（服务存活）
2) `GET /readyz`：检查 PostgreSQL/Redis 连接与第三方 API 可达；失败返回 503

验收标准：部署平台通过 `/readyz` 作为上线就绪判定。

---

## 5. 数据库集成与迁移

必做事项：
- 设计并实现完整数据库结构（名称、表、关系、索引）；提供完整初始化 SQL 脚本；集成 SQLx 连接池与迁移。

数据库名称：
- `kmarket_db`

表结构（逐表列出）：

1) `users`（用户）
- 字段：
  - `id` SERIAL PRIMARY KEY
  - `wallet_address` VARCHAR(42) UNIQUE NOT NULL（EVM 地址，校验长度）
  - `display_name` VARCHAR(64) DEFAULT NULL
  - `role` VARCHAR(16) NOT NULL DEFAULT 'user'（CHECK IN ('user','admin')）
  - `last_login` TIMESTAMP DEFAULT NULL
  - `created_at` TIMESTAMP NOT NULL DEFAULT NOW()
- 说明：存储用户基础信息与权限；后续会与 `orders.user_address` 建立外键关联。

2) `markets`（市场）
- 字段：
  - `id` SERIAL PRIMARY KEY（内部主键）
  - `market_id` BIGINT UNIQUE NOT NULL（链上合约内市场唯一 ID）
  - `title` VARCHAR(128) NOT NULL
  - `category` VARCHAR(32) NOT NULL DEFAULT 'general'
  - `status` market_status NOT NULL DEFAULT 'draft'（PostgreSQL ENUM，见 SQL 示例）
  - `created_at` TIMESTAMP NOT NULL DEFAULT NOW()
  - `opened_at` TIMESTAMP DEFAULT NULL
  - `closed_at` TIMESTAMP DEFAULT NULL
  - `settled_at` TIMESTAMP DEFAULT NULL
  - `winning_option` SMALLINT DEFAULT NULL（结算后胜出选项）
  - `description` TEXT DEFAULT NULL
  - `admin_user_id` INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL
- 说明：一个市场可有多个选项；链上 ID 与本地主键分离，便于迁移与审计。

3) `market_options`（市场选项）
- 字段：
  - `id` SERIAL PRIMARY KEY
  - `market_id` BIGINT NOT NULL REFERENCES markets(market_id) ON DELETE CASCADE
  - `code` SMALLINT NOT NULL（选项编码，如 0/1/2）
  - `label` VARCHAR(64) NOT NULL（展示文案）
  - `initial_odds` INTEGER DEFAULT NULL（可选：初始赔率，单位 1e2 或 1e4）
- 约束与索引：
  - `UNIQUE (market_id, code)`（用于订单的复合外键）
  - `INDEX idx_market_options_market (market_id)`

4) `orders`（订单/投注单）
- 字段：
  - `id` SERIAL PRIMARY KEY
  - `order_id` BIGINT UNIQUE NOT NULL（业务层订单号）
  - `user_address` VARCHAR(42) NOT NULL REFERENCES users(wallet_address)
  - `market_id` BIGINT NOT NULL REFERENCES markets(market_id)
  - `amount` NUMERIC(78,0) NOT NULL（投注金额，整型精度）
  - `odds` INTEGER NOT NULL（下单时赔率快照）
  - `option` SMALLINT NOT NULL（选项编码）
  - `potential_payout` NUMERIC(78,0) DEFAULT NULL（可能收益，含本金或仅利润，视业务定义）
  - `settled` BOOLEAN NOT NULL DEFAULT false
  - `claimed` BOOLEAN NOT NULL DEFAULT false
  - `tx_hash` VARCHAR(66) DEFAULT NULL（链上确认哈希，可为空）
  - `created_at` TIMESTAMP NOT NULL DEFAULT NOW()
- 约束与索引：
  - 复合外键：`FOREIGN KEY (market_id, option) REFERENCES market_options(market_id, code)`
  - 索引：`idx_orders_user(user_address)`、`idx_orders_market(market_id)`、`idx_orders_status(settled, claimed)`

5) `order_claims`（订单兑奖/领取记录）
- 字段：
  - `id` SERIAL PRIMARY KEY
  - `order_id` BIGINT UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE
  - `claim_amount` NUMERIC(78,0) NOT NULL
  - `claim_tx_hash` VARCHAR(66) DEFAULT NULL
  - `claimer_address` VARCHAR(42) NOT NULL
  - `status` VARCHAR(16) NOT NULL DEFAULT 'success'（CHECK IN ('success','failed','pending')）
  - `claimed_at` TIMESTAMP NOT NULL DEFAULT NOW()
- 索引：`idx_order_claims_order(order_id)`、`idx_order_claims_claimer(claimer_address)`

6) `chain_events`（链上事件日志）
- 字段：
  - `id` SERIAL PRIMARY KEY
  - `event_type` VARCHAR(32) NOT NULL（如 BetPlaced/MarketSettled）
  - `tx_hash` VARCHAR(66) UNIQUE NOT NULL
  - `block_number` BIGINT NOT NULL
  - `block_timestamp` TIMESTAMP NOT NULL
  - `market_id` BIGINT DEFAULT NULL REFERENCES markets(market_id) ON DELETE SET NULL
  - `order_id` BIGINT DEFAULT NULL REFERENCES orders(order_id) ON DELETE SET NULL
  - `raw` JSONB NOT NULL
  - `created_at` TIMESTAMP NOT NULL DEFAULT NOW()
- 索引：`idx_chain_events_market(market_id)`、`idx_chain_events_order(order_id)`、`idx_chain_events_type(event_type)`

7) `admin_actions`（管理审计）
- 字段：
  - `id` SERIAL PRIMARY KEY
  - `admin_user_id` INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
  - `action_type` VARCHAR(32) NOT NULL（如 create_market/close_market）
  - `resource_type` VARCHAR(32) NOT NULL（如 market/order）
  - `resource_id` VARCHAR(64) NOT NULL（对应资源的业务 ID）
  - `payload` JSONB DEFAULT '{}'::jsonb
  - `created_at` TIMESTAMP NOT NULL DEFAULT NOW()
- 索引：`idx_admin_actions_admin(admin_user_id)`、`idx_admin_actions_type(action_type)`、`idx_admin_actions_created(created_at)`

关系图（文字描述）：
- `users (1) → (N) orders`：通过 `orders.user_address → users.wallet_address` 建立引用。
- `markets (1) → (N) market_options`：一个市场对应多个选项。
- `markets (1) → (N) orders`：市场内可产生多笔订单。
- `orders (1) → (1) order_claims`：每笔订单最多对应一笔兑奖记录。
- `markets (1) → (N) chain_events`；`orders (1) → (N) chain_events`：事件日志可归属市场或订单。
- `users (1) → (N) admin_actions`：管理员操作审计。

必要索引设计（覆盖核心查询路径）：
- 用户维度查询：`orders(user_address)`、`order_claims(claimer_address)`。
- 市场维度查询：`orders(market_id)`、`market_options(market_id)`、`markets(status)`。
- 结算与状态：`orders(settled, claimed)`、`markets(winning_option)`。
- 事件追踪：`chain_events(tx_hash)` 唯一；类型/归属维度多列索引。

SQL示例（完整初始化脚本）：
```sql
-- 1) 数据库创建（需管理员权限）
-- CREATE DATABASE kmarket WITH ENCODING 'UTF8';
-- 
-- 使用时切换到 kmarket：\c kmarket

-- 2) ENUM 类型：市场状态
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_status') THEN
    CREATE TYPE market_status AS ENUM ('draft','active','closed','settled','cancelled');
  END IF;
END $$;

-- 3) users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  display_name VARCHAR(64) DEFAULT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'user',
  last_login TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_role CHECK (role IN ('user','admin'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 4) markets
CREATE TABLE IF NOT EXISTS markets (
  id SERIAL PRIMARY KEY,
  market_id BIGINT UNIQUE NOT NULL,
  title VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'general',
  status market_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMP DEFAULT NULL,
  closed_at TIMESTAMP DEFAULT NULL,
  settled_at TIMESTAMP DEFAULT NULL,
  winning_option SMALLINT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  admin_user_id INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_created ON markets(created_at);

-- 5) market_options
CREATE TABLE IF NOT EXISTS market_options (
  id SERIAL PRIMARY KEY,
  market_id BIGINT NOT NULL REFERENCES markets(market_id) ON DELETE CASCADE,
  code SMALLINT NOT NULL,
  label VARCHAR(64) NOT NULL,
  initial_odds INTEGER DEFAULT NULL,
  UNIQUE (market_id, code)
);
CREATE INDEX IF NOT EXISTS idx_market_options_market ON market_options(market_id);

-- 6) orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id BIGINT UNIQUE NOT NULL,
  user_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  market_id BIGINT NOT NULL REFERENCES markets(market_id),
  amount NUMERIC(78,0) NOT NULL,
  odds INTEGER NOT NULL,
  option SMALLINT NOT NULL,
  potential_payout NUMERIC(78,0) DEFAULT NULL,
  settled BOOLEAN NOT NULL DEFAULT false,
  claimed BOOLEAN NOT NULL DEFAULT false,
  tx_hash VARCHAR(66) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (market_id, option) REFERENCES market_options(market_id, code)
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_address);
CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(settled, claimed);

-- 7) order_claims
CREATE TABLE IF NOT EXISTS order_claims (
  id SERIAL PRIMARY KEY,
  order_id BIGINT UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  claim_amount NUMERIC(78,0) NOT NULL,
  claim_tx_hash VARCHAR(66) DEFAULT NULL,
  claimer_address VARCHAR(42) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'success',
  claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_claim_status CHECK (status IN ('success','failed','pending'))
);
CREATE INDEX IF NOT EXISTS idx_order_claims_order ON order_claims(order_id);
CREATE INDEX IF NOT EXISTS idx_order_claims_claimer ON order_claims(claimer_address);

-- 8) chain_events
CREATE TABLE IF NOT EXISTS chain_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(32) NOT NULL,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMP NOT NULL,
  market_id BIGINT DEFAULT NULL REFERENCES markets(market_id) ON DELETE SET NULL,
  order_id BIGINT DEFAULT NULL REFERENCES orders(order_id) ON DELETE SET NULL,
  raw JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chain_events_market ON chain_events(market_id);
CREATE INDEX IF NOT EXISTS idx_chain_events_order ON chain_events(order_id);
CREATE INDEX IF NOT EXISTS idx_chain_events_type ON chain_events(event_type);

-- 9) admin_actions
CREATE TABLE IF NOT EXISTS admin_actions (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(32) NOT NULL,
  resource_type VARCHAR(32) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at);
```

实施建议：
- 连接池：`sqlx::PgPool` 初始化并注入 `AppData`；启用 `SQLX_OFFLINE=true` 以缩短编译时间（开发期可选）。
- 迁移：将上述 SQL 拆分到 `migrations/`，按类型与表分批创建，确保幂等（IF NOT EXISTS）。

验收标准：
- 迁移在空库与已有库上均可执行；核心 CRUD 与事务（下单入库、结算更新、兑奖插入）通过；索引在实际查询路径上生效（EXPLAIN ANALYZE 观察）。

---

## 6. Redis 缓存与会话

必做事项：
- 建立连接池；实现键设计与 TTL

步骤：
1) 连接：`redis::Client` + `aio::ConnectionManager`
2) 键策略：
   - `odds:{marketId}` → `{ odds_a, odds_b, timestamp }`，TTL：60s
   - `markets:active` → 列表快照，TTL：30s
   - `session:{token}` → `{ userId, address }`，TTL：7d

验收标准：缓存命中率可观察；Redis 故障时不影响核心写路径（降级）。

---

## 7. 认证与 JWT 会话

必做事项：
- 钱包签名验证、用户入库、JWT 发放与校验

步骤：
1) `POST /auth/verify-sig`
   - 使用 `ethers::utils::hash_message/ recover` 恢复地址并比对
   - 查询或创建用户，更新 `last_login`
   - 生成 JWT（`jsonwebtoken`，7 天），写入 `session:{token}`
2) 路由保护：中间件校验 JWT 并注入用户上下文

验收标准：签名不匹配拒绝；JWT 过期控制与撤销（删除 Redis session）。

---

## 8. 市场 API（MarketSvc）

必做事项：
- 列表与详情；聚合当前赔率；缓存与 DB 回退

步骤：
1) `GET /markets`：读缓存或 DB；支持筛选/排序
2) `GET /markets/{id}`：聚合市场元数据与 `odds:{id}` 当前赔率
3) 管理端：创建/编辑市场（`POST/PUT /admin/markets`）

验收标准：接口响应快速；缓存一致性策略明确（写后刷新/延迟）。

---

## 9. 赔率服务（OddsSvc）

必做事项：
- 第三方 API 拉取、规范化、校验与缓存；兜底与手动覆盖

步骤：
1) 拉取与校验：限制数值范围、时间戳有效性
2) 写入缓存：`odds:{marketId}`，TTL 60s
3) 兜底策略：API 故障 → 使用最近一次有效值或手动覆盖值
4) 管理端手动覆盖：`POST /admin/odds/override`（记录审计）

验收标准：API 故障时用户仍可下单（在滑点保护范围内）。

---

## 10. WebSocket 实时推送

必做事项：
- 基于 `actix-web-actors/actix_ws` 推送市场赔率与状态；心跳与断线重连

步骤：
1) 握手与会话管理：`/ws/odds`；按 `marketId` 订阅房间
2) 心跳：定时 `ping`，无响应断开；客户端重连
3) 广播：当 `odds:{marketId}` 更新时向订阅者推送

验收标准：弱网环境（50–500ms 延迟）下消息可靠送达且不乱序（带版本号/时间戳）。

---

## 11. 投注服务（BettingSvc，链上）

必做事项：
- 下单接口、参数校验、ethers-rs 调用合约、入库与幂等

步骤：
1) `POST /bets`
   - 校验 `amount`、`option`、`currentOdds`、`maxSlippage`
   - 检查 `allowance` 与余额；调用 `PredictionMarket.placeBet(...)`
   - 记录 `tx_hash`；等待回执或异步确认
   - 入库 `orders`，状态初始 `settled=false, claimed=false`
2) 幂等：对请求生成幂等键（用户+市场+参数+时间窗）避免重复下单
3) 失败重试：链上失败时返回错误并记录原因；可重试与告警

验收标准：端到端从请求到链上回执与入库闭环完整；错误路径可追踪。

---

## 12. 结算服务（SettleSvc）

必做事项：
- 订阅链上事件，更新订单状态；支持重试与幂等

步骤：
1) 监听 `MarketSettled/BetPlaced` 等事件
2) 更新 `orders.settled/claimed` 并记录事件版本与 `tx_hash`
3) 处理链重组（reorg）：以区块最终性为准；幂等更新避免重复

验收标准：结算状态与链上一致；重复事件不导致状态错乱。

---

## 13. 管理后台 API（Admin）

必做事项：
- 市场管理、赔率覆盖、风控策略入口；严格鉴权与审计

步骤：
1) `POST/PUT /admin/markets` 创建/编辑/结算标记
2) `POST /admin/odds/override` 手动覆盖赔率（记录操作者与原因）
3) 风控：限额、白名单、黑名单接口与配置

验收标准：仅授权用户可操作；所有敏感操作可审计与回滚。

---

## 14. 安全与风控

必做事项：
- CORS、限流、输入校验、HTTPS 强制；后端审计与告警

步骤：
1) CORS 精准允许来源与方法，拒绝任意来源
2) 限流：`actix-governor` 按 IP/Token/路径维度配置
3) 输入校验：数值范围、正负、精度、必填项
4) HTTPS 强制与 JWT 有效期控制；撤销机制（删除 Redis session）

验收标准：压测下限流生效；非法输入被拒绝；跨域安全可靠。

---

## 15. 观测性与指标

必做事项：
- 结构化日志（tracing）、请求耗时与错误率指标、健康面板

步骤：
1) tracing 集成：统一日志上下文（request_id、user_address）
2) 指标：请求时延、QPS、错误率、缓存命中率、WS 会话数
3) 健康面板：Prometheus + Grafana（可选）

验收标准：故障可定位；性能趋势可见；预警及时。

---

## 16. 测试策略

必做事项：
- 单元、集成、端到端与压力测试；弱网/乱序模拟

步骤：
1) 单元：服务层与路由层逻辑；输入校验与边界
2) 集成：DB/Redis/WebSocket/ethers-rs 调用；事务与幂等
3) E2E：下单→入库→链上→结算→状态同步全链路
4) 压力与弱网：延迟 50–500ms、消息乱序与重试机制验证

验收标准：关键路径覆盖；失败场景可复现与定位；性能达标。

---

## 17. CI/CD 与部署

必做事项：
- 构建、测试、镜像与发布；就绪判定与回滚

步骤：
1) CI：`cargo fmt`/`clippy`/`test`、`sqlx` 离线校验、Docker 构建
2) 部署：Docker/Compose 或 systemd；加载 `.env`；运行迁移
3) 就绪判定：`/readyz` OK 后切流；失败自动回滚上一个版本

验收标准：一键发布与回滚；部署安全可靠；配置可版本化。

---

## 18. 风险与回滚策略

必做事项：
- 兜底与特性开关；镜像与数据回滚；Redis 键清理

步骤：
1) 赔率来源切换：主备 API 与手动覆盖开关
2) 镜像回滚：上一版本镜像与数据库迁移回滚脚本
3) Redis 键清理：异常状态下的键重建与 TTL 调整

验收标准：故障时可在 15 分钟内恢复关键功能。

---

## 交付清单与验收标准（里程碑）

- M1 基础服务：健康探针、中间件、限流、CORS；压测通过
- M2 数据存储：PostgreSQL 迁移与 CRUD；Redis 缓存与会话
- M3 认证闭环：签名验证与 JWT；路由保护
- M4 实时能力：赔率服务与 WebSocket 推送；弱网验证
- M5 投注闭环：接口入库与链上交互；幂等与重试
- M6 结算同步：事件监听与订单状态一致；管理后台操作
- M7 上线全套：安全、观测、CI/CD、部署与回滚

---

文档版本：v1.0  
维护者：后端团队  
更新时间：自动生成