# 前后端交接文档（kmarket-backend）

- 日期：2025-11-06
- 基本信息：Rust + Actix-Web + SQLx(PostgreSQL) + Redis + WebSocket
- Base URL（默认）：`http://127.0.0.1:8080`
- 版本约定：所有 REST 接口统一在 `GET/POST /api/v1/*` 下；WebSocket 握手为顶层 `/ws/*`

---

## 功能模块概览

- Config（`src/config`）
  - 加载环境：`BIND_ADDR`、`BIND_PORT`、`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`、`JWT_ISS`、`JWT_AUD`、`JWT_EXP_DAYS`、`READYZ_SKIP_PING`
- Cache（`src/cache`）
  - Redis 键与 TTL：
    - `odds:{market_id}`（60s，兼容旧结构）
    - `oddsq:{market_id}`（新结构，含 moneyline/spread/total）
    - `markets:active`（30s）
    - `session:{jwt}`（7d，可变 TTL）
    - `nonce:{address}`（5m）
- DB（`src/db`）
  - SQLx 连接池与仓储（`repo.rs`）：用户/市场/选项/订单/领取/审计等 CRUD
  - 迁移脚本：`migrations/*.sql`
- Models（`src/models`）
  - `user`、`market`、`market_option`、`order`、`order_claim`、`chain_event`、`admin_action`
- Services（`src/services`）
  - `market.rs`：MarketService 抽象 + Pg 实现
  - `odds.rs`：赔率计算（DB 初始值）
  - `settlement.rs`：结算、市胜方与订单潜在收益写库
  - `betting.rs`：BettingService 抽象 + `PgBettingService`（下单/列表/领取）
  - `user.rs`：UserService 抽象 + `PgUserService`（确保登录/查询/更新最后登录）
- Routes（`src/routes`）
  - `health.rs`、`ready.rs`、`markets.rs`、`odds.rs`、`bets.rs`、`session.rs`、`auth.rs`、`admin.rs`、`ws_health.rs`、`ws_token.rs`、`odds_snapshot.rs`、`odds_updates.rs`
- WebSocket（`src/ws.rs`）
  - Hub（Actix Actor）：订阅/取消/重放/统计；心跳 ping/pong；历史环形缓冲；广播
- 错误处理（`src/errors/mod.rs`）
  - 统一 `AppError` → HTTP 状态码与 JSON 错误体

---

## 认证与会话

- 获取一次性 `nonce`
  - `GET /api/v1/auth/nonce?address=<EVM地址>`
  - 成功：`{ "nonce": "uuid", "expiresIn": 300 }`
- 验签获取 JWT（EIP-191）
  - `POST /api/v1/auth/verify-sig`
  - Body：`{ "address": "0x...", "message": "Login to KMarket: nonce=<uuid>", "signature": "0x..." }`
  - 成功：`{ "token": "<jwt>", "expiresIn": 604800, "user": { "id": 1, "address": "0x..", "role": "user" } }`
- 读取当前用户
  - `GET /api/v1/auth/me`（Header：`Authorization: Bearer <jwt>`）
  - 成功：`{ "id": 1, "address": "0x..", "role": "user", "last_login": 1730880000000 }`
- 登出并撤销会话
  - `POST /api/v1/auth/logout`（Header：Bearer）
  - 成功：`204 No Content`
- 会话备选（无需签名的临时会话）
  - `POST /api/v1/session` → 生成短期 JWT 并写 Redis 会话
  - `GET /api/v1/session/me`（Bearer） → 会话数据

---

## 市场与赔率

- 列表（无 DB 时返回内存示例）
  - `GET /api/v1/markets`
  - 响应（示例）：
    ```json
    { "page":1, "pageSize":20, "total":2, "items": [{"id":1001, "league":"sports", "title":"A vs B", "status":"active", "start_time":1730908800000, "odds":null}] }
    ```
- 详情（含赔率聚合）
  - `GET /api/v1/markets/{id}`
  - 响应：`{ "market": { ... }, "odds": { "moneyline": {"home":1.85,"away":2.10}, "timestamp": 1730..., "source":"cache|db" } }`
- 活动市场快照（Redis 优先）
  - `GET /api/v1/markets/active`
  - 响应：`{ "source":"cache|db", "data": [{"market_id":1001,"title":"...","category":"sports"}] }`
- 赔率读取（兼容旧字段）
  - `GET /api/v1/odds/{market_id}`
  - 响应：
    ```json
    { "marketId":1001, "odds_a":185, "odds_b":210, "moneyline": {"home":1.85,"away":2.10}, "timestamp":1730..., "source":"cache|db" }
    ```
- 赔率快照（REST）
  - `GET /api/v1/markets/{market_id}/odds/snapshot`
- 赔率增量（REST 补全 WS）
  - `GET /api/v1/markets/{market_id}/odds/updates?since_seq=<seq>&limit=<N>`
  - 响应：`{ "marketId":1001, "fromSeq":10, "toSeq":15, "updates": [ {"type":"odds_update", ...} ] }`

---

## 下注与结算

- 下单
  - `POST /api/v1/bets`
  - Body：`{ "marketId":1001, "option":1, "amount":"1000", "odds":185 }`
  - 响应：`{ "orderId":900001, "userAddress":"0x..", "marketId":1001, "amount":"1000", "odds":185, "option":1, "potentialPayout":null, "settled":false, "claimed":false, "txHash":"0x..." }`
- 查询订单
  - `GET /api/v1/bets/{order_id}`
- 列表
  - `GET /api/v1/bets?userAddress=0x..&marketId=1001&status=pending|confirmed&page=1&pageSize=20`
  - 响应：`{ "page":1, "pageSize":20, "total":X, "items":[OrderResp...] }`
- 领取
  - `POST /api/v1/bets/{order_id}/claim`
  - 响应：`{ "orderId":900001, "claimed": true, "claimAmount":"1850", "claimTxHash": null }`

---

## 管理接口（需 Bearer JWT 且角色为 admin）

- 创建市场
  - `POST /api/v1/admin/markets`
  - Body：`{ "league":"NBA", "home_team":"Lakers", "away_team":"Warriors", "start_time": 1730908800000 }`
  - 响应：`{ "id": <market_id> }`
- 更新市场
  - `PUT /api/v1/admin/markets/{id}`（仅 `status`、`description` 简化）
- 赔率覆盖（写审计 → 穿缓存 → WS 广播）
  - `POST /api/v1/admin/odds/override`
  - Body（示例）：
    ```json
    {
      "market_id": 1001,
      "payload": {
        "moneyline": { "home": 1.82, "away": 2.15 },
        "spread": { "line": -3.0, "home": 1.92, "away": 1.88 },
        "total": { "line": 219.5, "over": 1.90, "under": 1.90 }
      },
      "reason": "Manual adjustment"
    }
    ```
- 结算市场
  - `POST /api/v1/admin/markets/{id}/settle`（Body：`{ "winning_option": 1 }`）

---

## WebSocket 协议

- 握手
  - `GET /ws/odds?token=<jwt>`（JWT 需 `aud=jwt_aud`、`iss=jwt_iss`；`roles` 可包含 `ws`）
- 客户端消息
  - 订阅：`{ "type":"subscribe", "markets":["1001","1002"] }`
  - 取消：`{ "type":"unsubscribe", "markets":["1001"] }`
  - 重放：`{ "type":"resume", "offsets": { "1001": 10 } }`
  - 心跳：服务器每 15s 发送 `ping`；客户端需 `pong` 自动处理（由浏览器 WS 驱动）
- 服务端消息（文本 JSON）
  - 广播更新：`{ "type":"odds_update", "payload": {...}, "seq": 123, "ts": 1730... }`
  - ACK：`{ "type":"ack", "ok": true, "subscribed": [1001,1002] }`
- REST 补全机制
  - 当 WS 断线或乱序时，客户端可调用 `GET /api/v1/markets/{id}/odds/updates?since_seq=<last_seq>` 拉取缺失增量

---

## 错误与状态码

- 统一返回格式（示例）：`{ "code": "BAD_REQUEST"|"UNAUTHORIZED"|"INTERNAL_ERROR"|..., "message": "..." }`
- 常见状态码：400/401/403/404/409/500/503

---

## 前端集成建议

- 认证流程
  1. `GET /api/v1/auth/nonce` → 拼接消息 `Login to KMarket: nonce=<uuid>`
  2. 钱包签名（EIP-191）→ `POST /api/v1/auth/verify-sig` → 得到 JWT
  3. 所有受保护接口添加 `Authorization: Bearer <jwt>`
- 市场详情页
  - 初始数据：`GET /api/v1/markets/{id}`（含当前赔率与来源）
  - 订阅更新：握手 `/ws/odds`，`subscribe` 指定 `market_id`
  - 断线恢复：`resume` + `REST updates`
- 列表页与快照
  - `GET /api/v1/markets` + `GET /api/v1/markets/active`（缓存优先）
- 下注表单
  - 提交：`POST /api/v1/bets`，金额为字符串（大整数），`odds` 为整数 bps（185→1.85）
  - 成功后刷新订单列表：`GET /api/v1/bets?userAddress=...`
- 领取流程
  - 先获取订单详情确认 `settled==true` 且 `potentialPayout>0` → `POST /api/v1/bets/{order_id}/claim`

---

## 数据格式与单位约定

- 时间戳单位：毫秒（ms）
- 金额类型：字符串（`NUMERIC(78,0)`）
- 赔率整数化：`bps`（如 185 → 1.85）
- 标识：`market_id`、`order_id` 为 `BIGINT`（毫秒时间戳生成的占位 ID）

---

## 依赖与运行说明（前端可参考）

- 必需环境变量：`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`
- 启动（后端）：`cargo run`（或 docker-compose）
- CORS：允许 `http://127.0.0.1`、`http://localhost`、`https://kmarket.com`，如需其它域名可在后端配置中扩展
- 速率限制：`10 req/s`，突发 `20`

---

## 变更提示（与旧版本差异）

- REST 前缀统一为 `/api/v1/*`；前端需将所有旧路径（`/markets`、`/healthz`、`/readyz` 等）更新至新前缀
- WebSocket 握手仍为 `/ws/odds`，但 WS 辅助接口（`/ws/token`、`/ws/health`）位于 `/api/v1` 作用域下
- 赔率接口同时保留旧字段 `odds_a`/`odds_b`，新结构为 `moneyline/spread/total`

---

> 如需补充字段或新增端点，请在本文件追加“变更记录”并通知前端同步更新。