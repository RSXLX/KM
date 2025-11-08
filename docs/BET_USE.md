# Bets 使用与完成说明（BET_USE.md）

本文件为投注与结算功能的快速使用与完成说明，配合接口详解文档 `docs/BACKEND_API_BETS_SETTLE.md` 与需求规范 `docs/BACKEND_REQUIREMENTS_BETTING_SETTLE.md` 使用，可在本项目后端中完成下注、结算与领取的业务闭环。

---

## 1. 概览
- 功能覆盖：
  - 下单下注（`POST /api/v1/bets`）
  - 订单查询（`GET /api/v1/bets/{orderId}`）
  - 订单列表（`GET /api/v1/bets`）
  - 领取收益（`POST /api/v1/bets/{orderId}/claim`）
  - 管理员结算市场（`POST /admin/markets/{id}/settle`）
- 结算规则：采用整数化赔率（如 `1.85 → 185`），以 `amount * odds / 100` 计算潜在收益；败方订单潜在收益为 `0`，所有订单在结算后标记 `settled=true`。
- 错误格式：统一为 `{ code: number, error: string }`，见下文“错误与排查”。

---

## 2. 快速开始
- 依赖环境：
  - Rust 与 Cargo（>= 1.75 建议）
  - PostgreSQL 数据库
  - Redis（可选，用于缓存与幂等键）
- 必要环境变量：
  - `DATABASE_URL`：Postgres 连接串
  - `JWT_SECRET`：后端签发与验证 JWT 的密钥
  - `REDIS_URL`（可选）：Redis 连接串
  - `PORT`（可选）：服务端口，默认 `8080`
- 启动步骤：
  1. 准备数据库并执行迁移（项目内含 `migrations`）：可通过外部迁移工具或项目内脚本，确保表结构齐备（`orders/markets/market_options/order_claims` 等）。
  2. 启动服务：`cargo run`（工作目录：`kmarket-backend/`）。
  3. 准备数据：保证存在可用的 `markets` 与 `market_options`；如需示例数据，可参考 `migrations/0010_seed.sql`。

---

## 3. 接口总览与约定
- 身份认证：除 `admin` 接口外，用户下注与查询均需在请求头携带 JWT：`Authorization: Bearer <TOKEN>`。
- 幂等约定：建议下注接口携带 `X-Idempotency-Key`（字符串），后端将以 Redis `SETNX` 实现 60s 窗口的幂等保护（文档已约定，若当前实现为占位，可按需启用）。
- 分页查询：列表接口支持 `page` 与 `pageSize`，默认 `page=1`，`pageSize=20`。
- 过滤参数：`marketId`、`userAddress`、`status`（`pending|confirmed`，内部映射为 `settled=false|true`）。

---

## 4. 字段与状态规范
- 金额字段：`amount` 以字符串传输（大整数，避免精度丢失），数据库端存储为数值类型。
- 赔率字段：`odds` 为整数化值（如 `1.85 → 185`）。
- 订单状态：
  - `settled: boolean`：是否已结算。
  - `potentialPayout: string`：潜在收益（字符串形式）
  - `claimed: boolean`：是否已领取（仅胜方且未领取时允许领取）。
- 查询 `status`：
  - `status=pending` → `settled=false`
  - `status=confirmed` → `settled=true`

---

## 5. 结算与领取规则
- 市场结算（管理员）：
  - 请求：`POST /admin/markets/{id}/settle`，Body：`{ "winning_option": <number> }`
  - 效果：将市场标记为 `settled`，并批量更新该市场下订单：
    - 胜方订单：`potential_payout = amount * odds / 100`，`settled=true`。
    - 败方订单：`potential_payout = 0`，`settled=true`。
- 领取收益（用户）：
  - 请求：`POST /api/v1/bets/{orderId}/claim`
  - 条件：`settled=true && potential_payout>0 && claimed=false`
  - 效果：写入 `order_claims` 记录并将订单标记为 `claimed=true`。
- 舍入与精度：采用整数化与数据库数值运算，避免浮点误差；如需更严格的精度控制，可改用定点数或大整数库。

---

## 6. cURL 示例
> 将 `BASE=http://localhost:8080` 与 `TOKEN=<your_jwt>` 替换为实际值。

- 下单下注
```bash
curl -X POST "$BASE/api/v1/bets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Idempotency-Key: 20241106-abc-123" \
  -d '{
    "marketId": 123,
    "option": 1,
    "amount": "1000000000000000000",  // 1e18 示例
    "odds": 185,
    "maxSlippage": 50
  }'
```

- 查询订单详情
```bash
curl -X GET "$BASE/api/v1/bets/1001" \
  -H "Authorization: Bearer $TOKEN"
```

- 列表查询（分页与过滤）
```bash
curl -X GET "$BASE/api/v1/bets?userAddress=0xabc...&marketId=123&status=pending&page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

- 管理员结算市场
```bash
curl -X POST "$BASE/admin/markets/123/settle" \
  -H "Content-Type: application/json" \
  -d '{ "winning_option": 1 }'
```

- 领取收益
```bash
curl -X POST "$BASE/api/v1/bets/1001/claim" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 7. 错误与排查
- 错误格式：`{ "code": <http_status>, "error": "<message>" }`
- 常见错误：
  - `400` 参数错误或风控拒绝（校验失败、选项非法、赔率越界等）。
  - `401` 未认证（缺少或无效 `Authorization`）。
  - `403` 授权不足（非管理员调用结算接口）。
  - `404` 资源不存在（订单或市场未找到）。
  - `409` 幂等冲突或重复领取（已领取的订单再次领取）。
  - `422` 余额或授权不足（未来链上集成校验）。
  - `429` 触发限流（全局或用户级限流）。
  - `503` 依赖未配置（数据库或 Redis 不可用）。
- 排查建议：
  - 检查日志（`tracing` 输出），确认路由与服务层入参。
  - 核对市场与选项是否存在、订单归属是否正确。
  - 确认结算后订单 `settled/claimed/potentialPayout` 字段值是否符合预期。

---

## 8. 测试与覆盖率
- 关键用例：`tests/bets_settle.rs`，覆盖下注→结算→查询→领取闭环。
- 运行：`cargo test`（工作目录：`kmarket-backend/`）。
- 环境变量：`DATABASE_URL` 与 `JWT_SECRET` 必须；若缺失，测试会跳过相应用例。
- 覆盖率建议：接入 `cargo-llvm-cov` 或 `grcov` 统计；当前集成测试已覆盖主要业务路径，可达高覆盖水平。

---

## 9. 监控与限流
- 限流：全局 `actix-governor`（10 req/s，突发 20）；建议对下注接口增加用户级限流策略（按 `userAddress`）。
- 监控：建议接入 Prometheus 指标（接口 QPS、P95、事件滞后），并在结算与领取流程增加关键事件计数。
- 日志：路由与服务层均已埋点 `info!`，用于追踪结算与领取关键步骤。

---

## 10. 版本与对齐
- 对齐文档：`docs/BACKEND_API_BETS_SETTLE.md`（接口说明）、`docs/BACKEND_REQUIREMENTS_BETTING_SETTLE.md`（需求、边界、测试与版本记录）。
- 当前规范版本：`v1.1.0`（包含术语、错误处理、边界条件、测试、可视化与变更记录）。

---

## 11. 后续规划（建议）
- 链上集成：将占位 `txHash` 替换为真实 `ethers-rs` 合约调用，完善余额与 `allowance` 校验。
- 幂等保护：下注接口启用 `X-Idempotency-Key` 校验（Redis `SETNX`，60s 窗口），与文档一致。
- 状态细分：订单增加 `pending/sent/confirmed/failed` 等状态，与链上事件联动更新。
- 精度控制：视业务需要改用定点数或大整数库处理金额与赔率计算，避免跨库转换误差。

---

## 12. 参考
- 代码位置：
  - 服务层：`src/services/settlement.rs`
  - 路由层：`src/routes/bets.rs`、`src/routes/admin.rs`、`src/routes/mod.rs`
  - 仓储层：`src/db/repo.rs`
  - 模型与迁移：`src/models/*`、`migrations/*`
- 进一步细节请参考：`docs/BACKEND_API_BETS_SETTLE.md`