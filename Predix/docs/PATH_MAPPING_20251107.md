# 路径映射表（前端 ↔ 后端）

> 目的：统一前端路径与后端真实接口路径，对所有代码引用逐条迁移；保留变量参数并确保符合 REST 规范。

## 映射总表

- `/api/positions` → `POST /api/v1/bets`（下单） / `GET /api/v1/bets`（列表）
- `/api/positions/close` → `POST /api/v1/bets/{order_id}/claim`
- `/api/markets`（PUT 更新） → `PUT /api/v1/admin/markets/{id}`（管理员，JWT）
- `/api/markets`（POST 创建） → `POST /api/v1/admin/markets`（管理员，JWT）
- `/api/markets`（GET 列表） → `GET /api/v1/markets`（公共）
- `/api/markets/{id}` → `GET /api/v1/markets/{id}`（公共）
- `/api/markets/active` → `GET /api/v1/markets/active`（公共）
- `/api/markets/{id}/odds/snapshot` → `GET /api/v1/markets/{id}/odds/snapshot`（公共）
- `/api/markets/{id}/odds/updates` → `GET /api/v1/markets/{id}/odds/updates`（公共）
- `/api/odds/{id}` → `GET /api/v1/odds/{id}`（公共）
- `/api/auth/*` → `/api/v1/auth/*`（公共）
- `/api/session*` → `/api/v1/session*`（公共）
- `/api/ws/health` → `GET /api/v1/ws/health`（公共）
- `/ws/odds?token=...`（握手）保持不变（根路径，非 `/api/v1`）
- `/api/database/health` → `GET /api/v1/readyz`（公共）
- `/api/wallet-ledger` → 暂无后端 REST（保留 Next Functions 或后续新增）
- `/api/events/*`、`/api/users/stats` → 暂无后端 REST（后续计划）

## 迁移策略

- 统一使用 `lib/api.ts` 的 `apiFetch(path)` 来拼接 `NEXT_PUBLIC_API_BASE_URL`（示例：`http://127.0.0.1:8080/api/v1`）。
- 变量参数保留：例如 `apiFetch(`/odds/${id}`)`。
- 管理员端点需携带 `Authorization: Bearer <token>`；前端调用前应完成 JWT 登录。

## 已迁移代码

- `components/layout/MainContent.tsx`：主页数据源改为 `GET /markets/active`。
- `components/sports/LiveInPlayGrid.tsx`：列表改为 `GET /markets/active`。
- `hooks/useActiveMarkets.tsx`：`/markets/active`。
- `hooks/useMarkets.ts`：`/markets` 列表分页。
- `hooks/useOdds.ts`：`/odds/{id}`，支持 refetchInterval。
- `hooks/useSportsBetting.ts`：详情 `GET /markets/{id}`，拆分 `title`。
- `lib/bets.ts`：`/bets` 下单/列表/详情/领取。
- `components/sports/ClosePositionModal.tsx`：开仓列表/平仓改为 `/bets` 与 `/bets/{id}/claim`。
- `app/database-status/page.tsx`：数据库健康改为 `GET /readyz`。
- `lib/event-listener.ts`：下单/平仓/结算改为 `/bets`、`/bets/{id}/claim`、`/admin/markets/{id}/settle`。

## 待迁移/保留项

- `lib/solana-ledger.ts`：`/api/wallet-ledger`（保留 Functions 或后端后续新增）。
- 文档中的旧接口示例（`/api/events/*`、`/api/users/stats`）：后端未提供，保留为规划项。

## 验证步骤

- 环境变量：`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/api/v1`
- 连通性：`GET /healthz`、`GET /readyz`、`GET /markets/active`、`GET /odds/{id}`
- 功能：Positions 页开关“使用后端 Bets API”后列表/领取正常；Sports Betting 赔率每 5s 自动刷新。
- 404 排查：确保所有新路径都含 `/api/v1` 前缀；WS 路径为根 `/ws/odds`。

---

如需将 `/api/wallet-ledger` 迁移到后端，我可以新增 REST：`POST /api/v1/wallet-ledger`（含记账入库与签名校验），并统一错误处理与 CORS。