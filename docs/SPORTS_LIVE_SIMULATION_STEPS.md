# 体育实时模拟联动落地步骤说明（操作小记）

本文记录已落地的交互行为与每一步的操作要点，便于测试与复盘。

**环境要求**
- 前端运行：Next.js 开发服务器（默认 `http://localhost:3000`）。
- 后端：Actix-Web 服务可用，且开放以下路由：
  - `GET /api/v1/markets/{market_id}`（读取市场详情）
  - `PUT /api/v1/markets/{id}`（更新市场状态，需 `expected_version`）
  - `POST /api/v1/admin/markets/{id}/settle`（结算市场，需 `winning_option`）
 - 环境变量：确保 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1`，避免把 `/api/v1/*` 误判为前端本地路由。

---

## 1. 选择目标比赛
- 在 `LiveInPlayGrid` 网格中点击某条比赛卡片以打开侧边栏（记录到 URL 参数 `?inplay={id}`）。
- 若比赛 `id` 为纯数字（例如 `101`），将作为后端 `market_id` 使用；否则进行仅前端模拟（不触达后端）。

操作位置：<mcfile name="LiveInPlayGrid.tsx" path="fronted/components/sports/LiveInPlayGrid.tsx"></mcfile>

---

## 2. 启动联动（Active + 前端模拟）
- 点击“启动”按钮后执行：
  1. 尝试解析所选比赛的 `market_id`（数字）。
 2. 若可解析：
     - `GET /api/v1/markets/{market_id}` → 读取 `id`（内部主键）与 `version`。
     - `PUT /api/v1/markets/{id}`，请求体 `{ expected_version, status: 'active' }`，将后端状态置为进行中（前端通过相对路径 `/markets/{id}` 调用，自动拼接 `NEXT_PUBLIC_API_BASE_URL`）。
     - 设置联动状态为“已与后端联动（linked）”。
  3. 若不可解析：
     - 进入“仅前端模拟（ui-only）”，不调用后端。
  4. 无论哪种情况，启动前端实时模拟器与 30 分钟倒计时。

操作位置：<mcfile name="LiveInPlayGrid.tsx" path="fronted/components/sports/LiveInPlayGrid.tsx"></mcfile>

---

## 3. 模拟推进（30分钟倒计时）
- 每秒更新剩余时间（显示为 `mm:ss`），模拟器每隔数秒推进比分、时间与阶段。
- 到达 30 分钟自动调用“停止并结算”。

操作位置：<mcfile name="LiveInPlayGrid.tsx" path="fronted/components/sports/LiveInPlayGrid.tsx"></mcfile>、<mcfile name="useLiveDataSimulator.ts" path="fronted/hooks/useLiveDataSimulator.ts"></mcfile>

---

## 4. 停止并结算（自动/手动）
- 点击“停止”或倒计时结束后执行：
  1. 停止前端实时模拟器；取消倒计时定时器。
  2. 根据当前比分判断 `winning_option`：主队胜=1，客队胜=2（平局简化为主队 1）。
  3. 若已与后端联动：
     - `POST /api/v1/admin/markets/{id}/settle`，请求体 `{ winning_option, resolved_at }`，将后端状态置为 `settled`（结束）（前端通过相对路径 `/admin/markets/{id}/settle` 调用，自动拼接 `NEXT_PUBLIC_API_BASE_URL`）。
     - 更新 UI 状态为“已结束（done）”。
  4. 若仅前端模拟：
     - 仅更新 UI 提示“模拟结束（前端）”。

操作位置：<mcfile name="LiveInPlayGrid.tsx" path="fronted/components/sports/LiveInPlayGrid.tsx"></mcfile>

---

## 5. 用户投注刷新与验收
- 结算后，进入“我的投注”页拉取用户持仓（兼容端点）：
  - `GET /api/v1/compat/users/{address}/positions?status=open|closed&fixture_id={id}`
- 验收：已结算订单展示胜负与盈亏；市场状态为 `settled`。

参考位置：<mcfile name="MyBet.tsx" path="fronted/components/sports/MyBet.tsx"></mcfile>

---

## 6. 并发与错误处理
- 并发冲突：`PUT /markets/{id}` 如提示版本不匹配，需重新 `GET` 拉取最新 `version` 后重试。
- 失败兜底：启动失败则进入“仅前端模拟”；结算失败则显示错误信息，支持再次尝试。

---

## 9. 故障修复记录（404 问题）
- 症状：访问 `http://localhost:3000/api/v1/markets/{id}` 返回 404（Next 本地不存在该路由）。
- 根因：`apiClient` 将所有以 `/api/` 开头的路径视为前端本地路由，导致 `/api/v1/*` 未使用后端 `BASE URL`。
- 修复：
  - 更新 `apiClient`：仅将 `/api/*` 且不包含 `/api/v1/*` 视为前端本地路由；`/api/v1/*` 走后端 `BASE URL`。
  - 组件调用统一使用相对路径（如 `/markets/{id}`、`/admin/markets/{id}/settle`），由 `NEXT_PUBLIC_API_BASE_URL` 拼接完整后端地址。

---

## 7. 已落地的 UI 提示与状态
- 控制面板新增：剩余时间（`mm:ss`）、联动状态（`idle/ui-only/linked/settling/done/error`）、信息提示。
- 启动按钮触发后端联动与倒计时；停止按钮触发结算流程。

操作位置：<mcfile name="LiveInPlayGrid.tsx" path="fronted/components/sports/LiveInPlayGrid.tsx"></mcfile>

---

## 8. 后续增强建议
- 支持“平局”选项的市场配置；或在结算时允许 `draw`。
- 将结算事件通过 WebSocket 推送到前端，实现更实时的视图更新。
- 引入 Redis 队列做后端定时任务，保障 30 分钟的结算在后端也可自动驱动。

参考设计：<mcfile name="REDIS_INTEGRATION.md" path="docs/REDIS_INTEGRATION.md"></mcfile>

---

以上步骤已与当前代码落地对齐，测试时请优先选择数字 `id` 的比赛以触发完整后端联动链路。