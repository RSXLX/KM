# Redis 集成方案（KMarket 项目）

本文档给出在现有项目架构（Actix-Web + SQLx 后端、Next.js 前端）中引入 Redis 的完整方案：适用场景、环境准备、集成步骤、键设计与一致性策略、限流与防护、Pub/Sub 扩展、队列、监控、风险与回退，以及验收清单与示例代码片段。该方案面向本地开发与生产部署，两者均可按需裁剪。

## 1. 为什么需要 Redis（结合当前架构）
- 缓存热点数据：
  - 市场列表（admin/markets）与体育赛程（sports_fixtures_v）等读多写少、查询复杂的数据。
  - 订单列表（admin/orders）在高并发下的分页与筛选结果。
- 分布式限流与防护：
  - 管理员登录、管理员写操作（创建市场、结算订单等）的 IP/账号限流。
- 会话/令牌辅助：
  - 基于 JWT 的无状态鉴权已上线；可结合 Redis 做 token 黑名单、refresh token 存储、强制登出等扩展。
- Pub/Sub 与横向扩展：
  - 作为事件总线，给 WebSocket 推送与多实例间消息广播提供基础能力（如 admin.markets/ admin.orders 的变更事件）。
- 任务队列与异步消费：
  - 写入 outbox 后异步推送、对账与定时扫描、重试与补偿。

## 2. 环境准备
- 选型：
  - 开发：`redis:alpine` 本地容器或本地安装。
  - 生产：云托管 Redis（AOF 持久化、备份与高可用）。
- Docker Compose（示例）：

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: kmarket-redis
    ports:
      - "6379:6379"
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - ./data/redis:/data

  redisinsight:
    image: redis/redisinsight:latest
    container_name: kmarket-redisinsight
    ports:
      - "5540:5540"
    depends_on:
      - redis
```

- 环境变量（建议）：
  - 后端 `.env`：`REDIS_URL=redis://127.0.0.1:6379/0`
  - 前端 `.env.local`（可选，仅 Next 代理使用）：`REDIS_URL=redis://127.0.0.1:6379/1`

## 3. 后端（Actix + SQLx）集成
- 依赖（Cargo.toml）：

```toml
[dependencies]
redis = { version = "0.24", features = ["aio", "tokio-comp"] }
# 如需连接池可选：
# deadpool-redis = "0.14"
```

- 初始化（示例）：在 `state.rs` 中增加 Redis 连接并注入 AppState。

```rust
use redis::aio::ConnectionManager; // 异步连接管理器

#[derive(Clone)]
pub struct AppState {
    pub db_pool: sqlx::PgPool,
    pub redis: ConnectionManager,
}

async fn init_redis() -> anyhow::Result<ConnectionManager> {
    let url = std::env::var("REDIS_URL")?;
    let client = redis::Client::open(url)?;
    let conn = client.get_tokio_connection_manager().await?;
    Ok(conn)
}

impl AppState {
    pub async fn new() -> anyhow::Result<Self> {
        // ... 初始化 Postgres 省略
        let redis = init_redis().await?;
        Ok(Self { db_pool: pool, redis })
    }
}
```

- 工具方法（JSON 缓存）：

```rust
use serde::{Serialize, de::DeserializeOwned};
use tokio::time::Duration;
use redis::AsyncCommands;

pub async fn cache_set_json<T: Serialize>(
    conn: &mut redis::aio::ConnectionManager,
    key: &str,
    value: &T,
    ttl_secs: usize,
) -> anyhow::Result<()> {
    let s = serde_json::to_string(value)?;
    let _: () = conn.set_ex(key, s, ttl_secs).await?;
    Ok(())
}

pub async fn cache_get_json<T: DeserializeOwned>(
    conn: &mut redis::aio::ConnectionManager,
    key: &str,
) -> anyhow::Result<Option<T>> {
    let v: Option<String> = conn.get(key).await?;
    Ok(match v { Some(s) => Some(serde_json::from_str::<T>(&s)?), None => None })
}
```

- 缓存策略（结合本项目）：
  - 市场列表（admin/markets）：
    - Key：`adm:markets:list:{page}:{limit}:{status?}:{q?}`
    - TTL：30~120 秒（运营频率较低，写操作后立即失效）
    - 失效事件：创建市场、编辑、下架、结算 → 删除相关列表 key。
  - 订单列表（admin/orders）：
    - Key：`adm:orders:list:{page}:{limit}:{status?}:{user?}:{market_id?}`
    - TTL：15~60 秒（写操作后失效）
  - 体育赛程（sports_fixtures_v）：
    - Key：`fixtures:{status}:{sport}:{league}:{page}:{limit}:{q?}`
    - TTL：30 秒（来源数据可能频繁变动，建议短 TTL）
  - 详情缓存：`adm:orders:detail:{id}`、`adm:users:detail:{id}`（TTL 60 秒，写后失效）。

- 限流（示例）：

```rust
// 令牌桶或固定窗口示例：每分钟最多 N 次
pub async fn rate_limit_check(
    conn: &mut ConnectionManager,
    scope: &str, // e.g. "admin:login:ip:{ip}" or "admin:write:user:{id}"
    max: i64,
    window_secs: usize,
) -> anyhow::Result<bool> {
    use redis::AsyncCommands;
    let cnt: i64 = conn.incr(scope, 1).await?;
    if cnt == 1 { let _: () = conn.expire(scope, window_secs).await?; }
    Ok(cnt <= max)
}
```

- Pub/Sub（横向扩展）：
  - 频道：`adm.events.markets`、`adm.events.orders`。
  - 在写操作后发布事件，其他实例通过订阅更新本地缓存或推送 WS。

```rust
use redis::AsyncCommands;

pub async fn publish_event(conn: &mut ConnectionManager, channel: &str, payload: &str) -> anyhow::Result<()> {
    let _: () = conn.publish(channel, payload).await?;
    Ok(())
}
```

- 队列（任务）：
  - 使用 Redis List/Stream 实现简易队列，如 `queue:outbox`，消费者轮询处理。
  - 推荐结合现有 outbox 表：写入 DB outbox → 异步拉取后推送，并在 Redis 中维护幂等标记。

## 4. 前端（Next.js）集成（可选）
- 适用场景：
  - 前端代理路由对热点数据进行短期缓存（减少对后端压力、降低响应时延）。
  - 例如：`/api/sports/fixtures`、管理员列表（若在前端代理查询）。
- 依赖：

```bash
npm i ioredis
```

- 示例（Node runtime 路由）：

```ts
// app/api/sports/fixtures/route.ts
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export const runtime = 'nodejs';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = `fixtures:${url.searchParams.toString()}`;
  const cached = await redis.get(key);
  if (cached) {
    return new Response(cached, { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
  const resp = await fetch(`${backend}/api/v1/sports/fixtures?${url.searchParams.toString()}`);
  const text = await resp.text();
  if (resp.ok) { await redis.setex(key, 30, text); } // TTL 30s
  return new Response(text, { status: resp.status, headers: { 'content-type': 'application/json' } });
}
```

- 注意：
  - Next 的路由需 `runtime = 'nodejs'` 才能连接 Redis。
  - 管理员接口一般由后端缓存与守卫控制，前端缓存仅针对公共只读数据。

## 5. 键设计与失效策略
- 命名规范：`<namespace>:<resource>:<scope>:<params>`
  - 示例：`adm:markets:list:1:20:active`、`adm:orders:detail:123`、`fixtures:live::EPL:1:50:q=chelsea`
- TTL 建议：
  - 列表 30~120 秒；详情 60 秒；体育赛程 30 秒；按业务灵活调整。
- 失效触发：
  - 写操作（创建/编辑/下架/结算/取消）后立即删除相关 key。
  - 发布 Pub/Sub 事件供其他实例同步失效或刷新内存缓存。
- 一致性：
  - 关键写路径不依赖缓存（先写 DB，再删缓存，再发布事件）。
  - 缓存更新使用写后失效策略，避免“读旧值”。

## 6. 限流与防护
- 登录限流：`rl:admin:login:ip:{ip}` → 60s/10 次；触发即 429。
- 写操作限流：`rl:admin:write:user:{id}` → 60s/20 次；异常场景防抖。
- 防爆破：对失败次数单独计数（如密码错误）。

## 7. Pub/Sub 与 WebSocket 扩展
- 将 Actix 的 WS 推送与 Redis Pub/Sub 结合：写操作后 publish 事件。
- 多实例部署时由每个实例订阅该频道，向它管理的连接广播事件。
- 频道示例：`adm.events.markets`、`adm.events.orders`（payload 为 JSON，含资源、动作、主键）。

## 8. 队列与异步任务
- 简易队列：Redis List `queue:outbox`，消费者 `BRPOP` 处理并写入审计日志。
- 幂等标记：`idemp:{event_id}` 设置短 TTL，重复消费时直接跳过。
- 定时任务：结合 cron 或后台 worker 定期扫描“未完成状态”的订单或市场，进行补偿。

## 9. 监控与告警
- 监控：`INFO`、`slowlog`、连接数、命中率、内存使用、阻塞操作统计。
- 告警：连接失败、超时比例升高、内存逼近阈值、命中率低于预期。
- 可集成 RedisInsight（上面的 compose 已给出）或云监控面板。

## 10. 安全
- 生产启用鉴权与 TLS（例如云 Redis 默认开启），限制公网访问。
- Key 不存储明文敏感信息（如用户密码）；token 或 email 的使用要注意 hash 或加盐（可选）。
- 严禁在日志输出完整 token 或敏感 payload。

## 11. 风险与回退
- Redis 宕机：
  - 后端所有缓存功能都应具备“降级为 DB 查询”的逻辑，限流与队列可短暂关闭或降低级别。
- 数据一致性：
  - 严格执行“写 DB → 删缓存 → 发布事件”顺序；禁止“写缓存代替写 DB”。
- 过期策略：
  - TTL 过短导致频繁 MISS；TTL 过长导致数据陈旧。建议按业务观察后调整。

## 12. 部署与配置
- 环境变量：
  - `REDIS_URL`（后端与前端代理）
  - `REDIS_TLS=true/false`（如需 TLS，使用 rediss://）
- 连接池（可选）：
  - `deadpool-redis` 配置最小/最大连接数、超时。

## 13. 验收清单（Checklist）
- [ ] 本地或生产 Redis 可用、连接正常。
- [ ] 后端已集成 Redis 连接与工具方法，AppState 注入成功。
- [ ] 列表与详情缓存命中与失效符合预期；写操作后删除缓存并发布事件。
- [ ] 管理员登录与写操作限流生效；阈值可配。
- [ ] Pub/Sub 事件发布与订阅验证（单实例与多实例均可）。
- [ ] 队列消费流程跑通（可用 BRPOP 简易验证）。
- [ ] 监控与告警配置完成（RedisInsight 或云监控）。
- [ ] 安全：生产环境启用鉴权与TLS，限制访问范围。

## 14. 示例：接入缓存到管理员市场列表（伪代码）

```rust
// routes/admin_markets.rs 中 list_markets 的开头加入：
use crate::utils::cache::{cache_get_json, cache_set_json};

pub async fn list_markets(..., state: web::Data<AppState>, query: web::Query<AdminMarketsQuery>) -> Result<HttpResponse> {
    let key = format!("adm:markets:list:{}:{}:{}:{}",
        page, limit, query.status.clone().unwrap_or_default(), query.q.clone().unwrap_or_default());
    let mut conn = state.redis.clone();

    if let Ok(Some(cached)) = cache_get_json::<serde_json::Value>(&mut conn, &key).await {
        return Ok(HttpResponse::Ok().json(ApiResponse::success(cached)));
    }

    // ... 原查询流程 ...

    let body = serde_json::json!({ "items": items, "pagination": { "page": page, "limit": limit, "total": total, "totalPages": ((total + limit - 1) / limit) } });
    let _ = cache_set_json(&mut conn, &key, &body, 60).await; // TTL 60s
    Ok(HttpResponse::Ok().json(ApiResponse::success(body)))
}
```

## 15. 示例：写操作后的失效

```rust
// create_market/update_market/deactivate_market/settle_market 成功后：
use redis::AsyncCommands;

fn affected_keys_for_market(market_id: i64) -> Vec<String> {
    vec![
        // 简化：实际应包含带筛选条件的列表 key（可使用模式匹配 + scan）
        "adm:markets:list:*".to_string(),
        format!("adm:markets:detail:{}", market_id),
    ]
}

pub async fn invalidate_market_cache(conn: &mut ConnectionManager, market_id: i64) -> anyhow::Result<()> {
    for k in affected_keys_for_market(market_id) { let _: () = conn.del(k).await?; }
    Ok(())
}
```

---

以上为 Redis 集成的整体方案。若你希望我将具体代码落地到项目（例如把缓存集成到 `admin_markets.rs` 列表与写操作、加入限流检查、添加 pub/sub 事件发布与消费者），告诉我优先级，我会分阶段提交代码变更并与现有守卫与审计逻辑一并联调。