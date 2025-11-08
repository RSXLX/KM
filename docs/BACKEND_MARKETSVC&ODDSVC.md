后端开发需求分析文档
1. 概述
本文围绕文档BACKEND_DEVELOPMENT_STEPS_ACTIX.md片段（第 8 节「市场 API」与第 9 节「赔率服务」）进行详细需求分析，面向 MVP 支持的两类赛事：NBA 和 英超（EPL）。
当前阶段以Mock 数据为准，外部数据源（第三方赔率/赛事 API）预留接口与适配层；对外 API 故障时，使用最近一次有效值或管理员覆盖值作为兜底。
目标：
市场列表与详情，聚合当前赔率，确保缓存优先、数据库回退。
赔率拉取、规范化与校验，缓存 TTL 管理与故障兜底，支持管理端手动覆盖与审计。
技术栈与实现基线：
Web 框架：Actix-Web
数据库：PostgreSQL + SQLx
缓存：Redis（键：odds:{marketId} TTL=60s；市场快照可选）
鉴权：JWT（管理端），后续启用

flowchart LR
  Client -->|HTTP| Actix[Actix-Web Routes]
  Actix --> Cache[(Redis)]
  Actix --> DB[(Postgres)]
  Actix --> OddsSvc
  OddsSvc --> ExtAPI[(External Odds API)]
  Cache <-->|TTL 60s| OddsSvc
  subgraph Admin
    AdminUI --> Actix
    Actix --> Audit[(Overrides + Audit)]
  end
  
2. 功能需求
2.1 核心功能模块
市场服务（MarketSvc）
列表与详情：从缓存或数据库读取市场与当前赔率聚合。
管理端：创建/编辑市场，发布/关闭状态维护。
缓存策略：写后刷新或延迟失效，保障一致性与性能。
赔率服务（OddsSvc）
拉取与校验：对外部 API 返回的赔率进行范围限制与时间戳有效性校验。
缓存与 TTL：写入 odds:{marketId}，TTL 60s，JSON 序列化。
故障兜底：API 故障时使用最近一次有效值或管理员覆盖值。
管理端手动覆盖：POST /admin/odds/override，记录审计（时间、操作者、变更前后值）。
2.2 子功能分解
市场列表（GET /markets）
过滤：league（NBA/EPL）、dateRange、team、status（active/closed/settled）。
排序：start_time、updated_at 等，默认升序。
分页：page + pageSize。
赔率聚合：在列表中合并当前赔率快照。
市场详情（GET /markets/{id}）
市场元数据（球队、联赛、开赛时间、市场类型）。
当前赔率（来自缓存；未命中走数据库或覆盖值）。
管理市场（POST/PUT /admin/markets）
创建：基础元信息与市场选项（moneyline/spread/total）。
编辑：更新元信息与状态；触发缓存失效或重建。
赔率拉取与校验
统一对外 API 适配接口（Provider）；支持Mock 模式。
校验规则：赔率区间、选择项完整性、时间戳不早于市场创建。
覆盖与审计
支持对指定市场/选项进行手动覆盖。
落库审计并写穿缓存（保证前端读取一致）。
缓存一致性
读路径：先读缓存 → 未命中读 DB → 写回缓存 → 返回。
写路径：落库后刷新缓存；或延迟失效（EXPIRE 与惰性更新）。
3. 技术架构
框架与库
Web：actix-web，中间件（日志、压缩、CORS、限流 actix-governor）。
数据库访问：sqlx（Postgres），迁移机制与连接池。
缓存：redis（aio::ConnectionManager），JSON 序列化（serde_json）。
数据模型（建议）
表：markets
字段：id、league（NBA/EPL）、season、match_id（外部事件 ID 预留）、home_team、away_team、start_time、status（active/closed/settled）、created_at、updated_at
表：market_options（一场比赛的多个投注项）
字段：id、market_id、option_type（moneyline/spread/total）、line（让分/大小分线）、selection（home/away/over/under）、status
表：odds_overrides（管理员手动覆盖）
字段：id、market_id、payload（JSON，含各选项赔率）、reason、operator_id、created_at
可选：odds_latest（最近一次有效赔率落库，作为 Redis 故障的 DB 兜底）
缓存键与 TTL
odds:{marketId} → { moneyline, spread, total, timestamp }，TTL=60s
可选快照：markets:active 列表缓存（TTL=30s）
一致性策略
优先缓存读取；缓存未命中时回退数据库并写回缓存。
管理端写入：写穿缓存（更新 DB 后立即更新缓存）。
市场状态变更：相关键主动失效或重建。
外部 API 适配层（预留）
trait OddsProvider { async fn fetch(&self, market_id: i64) -> OddsQuote; }
实现：MockOddsProvider、HttpOddsProvider（后者集成第三方 API）
Rust



// Actix 路由与缓存示例（伪代码/风格与现有实现一致）
#[get("/markets/{id}")]
async fn get_market(state: web::Data<AppState>, path: web::Path<i64>) -> impl Responder {
    let market_id = path.into_inner();

    // 读取市场详情（DB）
    let market = sqlx::query_as::<_, Market>("SELECT * FROM markets WHERE id=$1")
        .bind(market_id)
        .fetch_one(&state.pg_pool)
        .await
        .map_err(actix_web::error::ErrorNotFound)?;

    // 读取当前赔率（Redis 优先）
    let odds = if let Some(redis) = &state.redis_client {
        let mut conn = cache::store::get_conn(redis).await?;
        match store::get_odds(&mut conn, market_id).await? {
            Some(o) => Some(o),
            None => {
                // DB 兜底或管理员覆盖
                let o = db::odds::get_latest_or_override(&state.pg_pool, market_id).await?;
                // 写回缓存（TTL 60s）
                store::set_odds(&mut conn, market_id, &o, 60).await?;
                Some(o)
            }
        }
    } else {
        db::odds::get_latest_or_override(&state.pg_pool, market_id).await?
    };

    HttpResponse::Ok().json(MarketWithOdds { market, odds })
}



sequenceDiagram
  participant C as Client
  participant A as Actix Route
  participant R as Redis
  participant P as Postgres
  participant O as OddsProvider

  C->>A: GET /markets/{id}
  A->>P: SELECT market by id
  A->>R: GET odds:{id}
  alt cache hit
    R-->>A: odds snapshot
    A-->>C: 200 {market, odds}
  else cache miss
    A->>P: SELECT latest_or_override odds
    P-->>A: odds row
    A->>R: SETEX odds:{id} 60s
    A-->>C: 200 {market, odds}
  end

  Note over O: 后台任务定时拉取外部 API（预留）
4. 接口规范
通用规范
Base URL：/
格式：application/json；时间戳使用 epoch millis
状态码：200/201/204/400/401/404/409/429/500
认证：管理端必须 Authorization: Bearer <JWT>
市场列表
GET /markets
查询参数（可选）：league、team、status、dateFrom、dateTo、page、pageSize、sortBy、order
示例：/markets?league=NBA&dateFrom=2025-11-05&dateTo=2025-11-07&page=1&pageSize=20&sortBy=start_time&order=asc
响应示例：
JSON



{
  "page": 1,
  "pageSize": 20,
  "total": 237,
  "items": [
    {
      "id": 1001,
      "league": "NBA",
      "home_team": "Lakers",
      "away_team": "Warriors",
      "start_time": 1730908800000,
      "status": "active",
      "odds": {
        "moneyline": { "home": 1.85, "away": 2.10 },
        "spread": { "line": -3.5, "home": 1.90, "away": 1.90 },
        "total": { "line": 218.5, "over": 1.95, "under": 1.85 },
        "timestamp": 1730875800000,
        "source": "cache"
      }
    }
  ]
}
市场详情
GET /markets/{id}
响应：市场元数据 + 当前赔率（缓存优先）
404：{ "code": 404, "error": "not found: market {id} not found" }
管理市场
POST /admin/markets
请求体：
JSON



{
  "league": "EPL",
  "home_team": "Arsenal",
  "away_team": "Chelsea",
  "start_time": 1730912400000,
  "options": [
    { "type": "moneyline" },
    { "type": "spread", "line": -0.5 },
    { "type": "total", "line": 2.5 }
  ]
}
响应：201 { "id": 2001 }
PUT /admin/markets/{id}
请求体：允许更新 start_time、status、options 等
响应：204
赔率覆盖（审计）
POST /admin/odds/override
描述：管理员手动覆盖指定市场的赔率（按市场维度统一 JSON，内部映射到各选项）
请求体：
JSON



{
  "market_id": 1001,
  "payload": {
    "moneyline": { "home": 1.82, "away": 2.15 },
    "spread": { "line": -3.0, "home": 1.92, "away": 1.88 },
    "total": { "line": 219.5, "over": 1.90, "under": 1.90 }
  },
  "reason": "Manual adjustment for news impact"
}
响应：201 { "override_id": 5012, "applied": true }
副作用：写库审计 + 写穿缓存 odds:{marketId}（TTL 重置）
额外：赔率读取（单独路由）
GET /odds/{market_id}
优先读取 odds:{marketId}；未命中回退到 odds_latest 或覆盖值
响应：
JSON



{
  "marketId": 1001,
  "moneyline": { "home": 1.85, "away": 2.10 },
  "timestamp": 1730875800000,
  "source": "cache|db|override"
}
5. 性能指标
响应时间（p95）
缓存命中：< 100ms
DB 回退：< 300ms
吞吐量与可扩展性
GET /markets：≥ 500 req/s（共享缓存快照命中率 ≥ 90%）
GET /markets/{id}：≥ 800 req/s（热点市场）
缓存与命中率
odds:{marketId} TTL：60s；热门赛事命中率目标 ≥ 92%
降级策略
Redis 故障：不阻塞请求，直接 DB 回退并上报指标
外部 API 故障：使用最近有效值或管理员覆盖值，标注 source=override|db


graph TD
  A[请求进入] --> B{命中缓存?}
  B -- 是 --> C[返回缓存结果 <100ms]
  B -- 否 --> D[读DB并写回缓存 <300ms]
  D --> E{外部API可用?}
  E -- 是 --> F[后台刷新/异步更新]
  E -- 否 --> G[保留最近有效/覆盖值]

6. 安全需求
认证与授权
管理端强制 JWT；角色：admin
访问控制：仅 admin 可调用 /admin/* 路由
输入校验与保护
参数白名单与类型校验（league、status、sortBy）
赔率区间限制（如 decimal 1.01–100.00；spread/total 合理线范围）
传输与存储安全
HTTPS（生产）；环境变量与敏感配置不落盘
Redis 鉴权与网络隔离；禁用危险命令
速率与审计
限流（actix-governor）：公共接口与管理接口分别配置
审计日志：记录覆盖操作、失败降级、缓存写入与失效
7. 部署要求
环境变量
DATABASE_URL、REDIS_URL、PORT
ODDS_PROVIDER_URL（预留；Mock 模式下忽略）
ENABLE_MOCK=true（初期）
容器与编排
PostgreSQL + Redis + Actix-Web 服务；健康检查 GET /healthz、GET /readyz
滚动升级与灰度（避免缓存雪崩）
迁移与初始化
SQLx 迁移；初始市场数据（NBA/EPL）以 Mock 形式写入
监控与告警
指标：命中率、延迟、错误率、覆盖次数
日志：结构化 + 请求追踪 ID
YAML



# docker-compose 片段（示例）
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kmarket_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 55258864
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    ports: ["6379:6379"]
  backend:
    image: kmarket-backend:latest
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/kmarket_db
      REDIS_URL: redis://redis:6379
      ENABLE_MOCK: "true"
    ports: ["8080:8080"]
    depends_on: ["postgres", "redis"]
加粗要点回顾：

以 NBA/EPL 为 MVP 的市场与赔率双服务。
赔率缓存键 odds:{marketId}，TTL 60s，缓存优先、DB 回退。
外部 API 预留适配层，故障时使用最近有效值或管理员覆盖。
管理端提供 手动覆盖与审计，写库后写穿缓存确保一致性。
性能目标：缓存命中 p95 <100ms，DB 回退 p95 <300ms；命中率 ≥92%。