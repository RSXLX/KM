# 体育实时模拟联动与结算需求说明

- 目标：在前端的比赛列表中将一条 `pre`（赛前）数据切换为 `live`（进行中），在进行中阶段展示并推进比赛统计（时间、比分、阶段、赔率趋势等），最多持续 30 分钟；任务结束后自动将比赛状态改为 `ended/settled` 并触发用户下注的结算。
- 范围：前后端联动，使用现有数据结构与接口；前端以 UI 模拟器驱动可视化，后端负责市场状态持久化与结算。

**术语与状态映射**
- 前端展示状态：`pre` → `live` → `ended`
- 后端市场状态（Rust 枚举 `MarketStatus`）：`Pending` → `Active` → `Settled`（取消为 `Cancelled`）
- 映射关系：`pre ≈ Pending`，`live ≈ Active`，`ended ≈ Settled`

**关键文件与模块**
- 前端：
  - 比赛网格与模拟控制面板：<mcfile name="LiveInPlayGrid.tsx" path="fronted/components/sports/LiveInPlayGrid.tsx"></mcfile>
  - 下注主逻辑与 Live 开关：<mcfile name="useSportsBetting.ts" path="fronted/hooks/useSportsBetting.ts"></mcfile>
  - 实时数据模拟器：<mcfile name="liveDataSimulator.ts" path="fronted/lib/sports/liveDataSimulator.ts"></mcfile>
  - 用户投注查询与展示：<mcfile name="MyBet.tsx" path="fronted/components/sports/MyBet.tsx"></mcfile>
  - 数据类型（DB/API 层）：<mcfile name="database.ts" path="fronted/types/database.ts"></mcfile>
- 后端：
  - 市场路由与状态更新：<mcfile name="markets.rs" path="kmarket-backend/src/routes/markets.rs"></mcfile>
  - 管理端市场结算：<mcfile name="admin_markets.rs" path="kmarket-backend/src/routes/admin_markets.rs"></mcfile>
  - 兼容输出（前端 DB/API 结构）：<mcfile name="compat.rs" path="kmarket-backend/src/routes/compat.rs"></mcfile>
  - 模型与状态枚举：<mcfile name="market.rs" path="kmarket-backend/src/models/market.rs"></mcfile>
  - 接口总览：<mcfile name="API.md" path="kmarket-backend/docs/API.md"></mcfile>
  - 前后端映射策略：<mcfile name="BACKEND_FRONTEND_MAPPING.md" path="kmarket-backend/docs/BACKEND_FRONTEND_MAPPING.md"></mcfile>
  - Redis 集成与任务队列建议：<mcfile name="REDIS_INTEGRATION.md" path="docs/REDIS_INTEGRATION.md"></mcfile>

---

## 现状与数据结构对齐

**前端数据结构与能力**
- `LiveInPlayGrid.tsx` 支持 `status` 为 `'live' | 'pre'`，当为 `live` 时启用 `useLiveDataSimulator` 实时更新比分、时间与赔率趋势（UI 层模拟）。
- `useSportsBetting.ts` 提供 `startLive/stopLive`、`liveSeries`、`TICK_MS` 等，支持加载赛程（fixtures）与实时曲线绘制。
- `liveDataSimulator.ts` 定义 `LiveDataUpdate { scoreUpdate, timeUpdate, statusUpdate, oddsUpdate }`，并维护 `matches` 的状态推进、半场/阶段切换与趋势。
- `database.ts` 中的 `MarketState` 与 `PositionStatus`（数字枚举）用于前端 DB/API 层结构（兼容输出经由后端 `compat` 路由）。
- `MyBet.tsx` 通过 `/api/positions`（或 `compat/users/{address}/positions`）查询用户投注，支持展示 `expectedPayout`、`pnl`、`confirmation_status` 等。

**后端数据结构与接口**
- 市场状态更新：`PUT /api/v1/markets/{id}`（请求体包含 `expected_version` 与 `status: "pending|active|settled|cancelled"`）。
- 市场结算（管理员）：`POST /api/v1/admin/markets/{id}/settle`，请求体 `winning_option: 1|2`（结算为主/客队胜），并设置 `status = 'settled'` 与 `resolved_at`。
- 兼容输出：`/api/v1/compat/*` 提供前端所需 DB/API 对齐结构（市场与持仓/订单）。
- `MarketStats` 来源于订单聚合；`Order/Position` 状态与金额等字段可通过 `compat` 或专用路由获取。

---

## 联动需求与方案设计

**目标**
- 将目标赛事（对应市场）从 `pre` 切换到 `live`，期间每隔若干秒推进 UI 展示的统计数据，并在 30 分钟内完成；结束后自动设置市场为 `settled` 并按获胜队伍结算用户订单/持仓。

**整体流程（时序）**
1. 选择目标市场：前端选择某 `fixtureId/market_id`。
2. 切换到进行中：
   - 前端调用后端 `GET /api/v1/markets/{market_id}` 获取 `version`。
   - 前端调用 `PUT /api/v1/markets/{market_id}`，`status = 'active'`，并带上 `expected_version`（避免并发冲突）。
   - 前端将组件状态置为 `status='live'`，启用 `useLiveDataSimulator`；显示“实时数据模拟器控制面板”。
3. 模拟推进（最多 30 分钟）：
   - 前端每 `3s`（可配）更新比分、时间、阶段、赔率趋势；可选：向后端写入“模拟订单”（用于使 `MarketStats` 随时间增长），或仅 UI 可视化不写入（推荐先期仅 UI）。
   - 维护任务计时器：到达 30 分钟或手动停止即进入下一步。
4. 自动结算：
   - 前端根据最终比分计算 `winning_option`（主队=1，客队=2）。
   - 调用 `POST /api/v1/admin/markets/{id}/settle`（或新增非管理员结算接口，详见下文安全性与权限设计）。
   - 后端更新市场 `status='settled'` 与 `winning_option`，并触发订单/持仓结算（见“结算策略”）。
5. 刷新用户视图：
   - 前端刷新用户投注页（例如 `MyBet.tsx`），从 `/api/positions` 或 `compat/users/{address}/positions` 拉取最新结算结果；展示盈亏与已结算状态。

**结算策略（后端）**
- 结算目标：按 `winning_option` 更新该市场下所有用户订单/持仓的状态与 `payout/pnl`；与前端 `PositionStatus` 对齐（胜=2/负=3）。
- 方案 A（推荐）：为市场结算新增一条“批量结算订单”的内部流程，在 `admin_markets.rs::settle_market` 成功后触发：
  - 查询该市场所有未结订单；按 `selected_team` 对比 `winning_option` 设置 `status`（胜/负），计算 `payout`（基于 `amount` 与下注时 `multiplier_bps/odds_bps`），写入审计日志，发布事件（供 WS 推送/缓存失效）。
- 方案 B（现有接口拼装）：由前端或运营端循环调用 `admin_orders::settle_order`（若已实现）逐单结算；但并发与幂等需控制，整体效率较低。
- 兼容输出：结算完成后 `compat` 端点返回的 `positions` 应呈现最新 `status` 与 `pnl/payout_expected`。

**权限与安全**
- `admin/settle` 属于管理员接口：生产环境严禁普通用户调用；测试/演示环境可通过前端代理受控调用（例如仅在 `NODE_ENV=development` 时暴露），或新增受限的“模拟赛”结算接口（后端校验来源与市场标记）。
- 市场状态更新 `PUT /markets/{id}` 可作为普通操作（若无鉴权）或在生产中仅 Admin 可改。

---

## 前端改动建议（针对 LiveInPlayGrid.tsx #L231-257）
- 交互控件：在“实时数据模拟器控制面板”中，增加“开始联动”与“结束并结算”动作：
  - 开始联动：
    - 通过 API 将目标市场从 `pending` 更新为 `active`（读取 `version` 后 `PUT`）。
    - 将组件 `status='live'`，`startSimulation()` 启动模拟器，并开始 30 分钟倒计时；UI 显示运行状态与剩余时间。
  - 结束并结算：
    - 调用 `stopSimulation()` 停止；根据最终比分判定 `winning_option`；调用后端结算（优先使用 Admin 路由或受限代理）。
    - 自动刷新用户投注页面数据（触发 `MyBet.tsx` 的数据刷新）。
- 错误处理与并发控制：
  - 若 `update_market_status` 返回并发冲突（`expected_version` 不匹配），提示用户重试并重新拉取 `version`。
  - 后端结算失败时，保留比赛结束状态但标注“结算进行中”，前端定时重试或人工重试。
- 显示优化：
  - 正在运行时禁用“启动”按钮；停止后禁用“停止”按钮。
  - 展示“联动成功/失败”提示与结算摘要（胜方、总订单数、已结算笔数）。

---

## 后端接口使用（示例与约定）

- 切换到进行中（Active）
  - `GET /api/v1/markets/{id}` → 读取 `version`
  - `PUT /api/v1/markets/{id}`
    - 请求体：`{ "expected_version": <int>, "status": "active" }`
    - 成功：返回更新后的市场记录
- 结算市场（Settled）
  - `POST /api/v1/admin/markets/{id}/settle`
    - 请求体：`{ "winning_option": 1 | 2, "resolved_at": <ISO8601，可选> }`
    - 成功：`{ id, status: "settled" }`
- 用户投注刷新
  - `GET /api/v1/compat/users/{address}/positions?status=open|closed&fixture_id=<id>`
  - 前端依此刷新 `MyBet.tsx` 的列表与结算信息

---

## 任务与计时（30 分钟）
- 前端计时器：进入 `live` 时启动倒计时（30 分钟），每 Tick 更新 UI；到时自动调用“结束并结算”。
- 后端（可选增强）：使用 Redis TTL 或 tokio 定时任务在后端标记与驱动结算（详见 <mcfile name="REDIS_INTEGRATION.md" path="docs/REDIS_INTEGRATION.md"></mcfile>）。

---

## 验收标准
- 将一条 `pre` 的赛事成功切换为 `live`（后端市场状态变更为 `Active`，前端 UI 启动模拟器）。
- 在 `live` 阶段，UI 中的比分、时间与赔率趋势持续推进（默认每 3s 更新）。
- 30 分钟后自动停止，后端市场状态更新为 `Settled` 且记录 `winning_option`。
- 用户下注数据在结算后刷新，显示胜负与盈亏；接口响应正确且无明显延迟。
- 并发控制有效（版本校验），失败重试与错误提示合理。

---

## 后续扩展建议
- 引入 WebSocket 推送，将市场状态变更与结算事件实时通知到前端；结合 Redis Pub/Sub 做多实例广播。
- 将“模拟订单”作为可选开关，便于演示 `MarketStats` 随时间增长的效果（注意与真实数据区分、加注模拟标记）。
- 管理端增加“模拟赛控制台”，集中管理预设赛程的启动、暂停、结算与复盘统计。

---

## 备注
- 本方案严格对齐现有后端接口与模型，不强行引入新表结构；若需要“批量结算订单”后端流程，可在 `admin_markets.rs::settle_market` 完成后追加内部处理以更新相关订单状态与审计事件。
- 生产环境需加固权限隔离；本文中的“前端触发结算”仅用于测试/演示环境或受控代理下。