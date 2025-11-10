# 管理员端 MVP 实施方案（订单 / 用户 / 市场）

## 0. 目标与范围
- 目标：在最短时间内交付一个可用的管理员端（仅限订单管理、用户管理、市场管理），支持基础的查询、编辑与状态操作。
- 范围：
  - 订单管理：列表与详情、取消、结算（写入 close_price/close_pnl/closed_at 并更新用户总盈亏）。
  - 用户管理：列表与详情、状态修改、黑白名单标记、用户统计查看（total_pnl、balance、订单数）。
  - 市场管理：列表与详情、创建、编辑（时间与赔率）、上下架、结算（winning_option、resolved_at）。
- 非目标（MVP 暂不包含）：RBAC 权限、审批流、报表与告警、WebSocket 推送、复杂风控策略。

## 1. 环境与前提
- 后端：Actix-Web + SQLx（现有项目基础），数据库 PostgreSQL。
- 前端：Next.js（App Router），复用现有项目结构，在 /admin 下新增页面。
- 鉴权：MVP 仅需单管理员登录（JWT），不做角色与权限细分；登录成功后访问 /api/v1/admin/*。

## 2. 数据库与最小增量（MVP）
- 新增表（最小必需）：
  - admin_users(id, email, password_hash, salt, status, created_at, updated_at)
  - audit_logs(id, actor_id, action, resource, resource_id, payload_json, created_at)
- 参考迁移（示例 SQL，仅文档）：
```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT NOT NULL,
  action VARCHAR(64) NOT NULL,
  resource VARCHAR(64) NOT NULL,
  resource_id BIGINT,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
```
- 种子脚本：插入首个管理员用户（email=admin@kmarket.local，密码需加盐哈希）。

## 3. 后端接口（MVP）
- 鉴权与会话
  - POST /api/v1/admin/auth/login → 200 { token, refreshToken? }
  - POST /api/v1/admin/auth/logout → 204
  - 中间件：AdminAuthMiddleware（校验 JWT），所有 /api/v1/admin/* 需登录态。

- 市场管理
  - GET /api/v1/admin/markets?page&limit&status&q → 列表与筛选
  - GET /api/v1/admin/markets/{id} → 详情
  - POST /api/v1/admin/markets → 创建 { market_id, title, option_a, option_b, start_time, end_time, status }
  - PUT /api/v1/admin/markets/{id} → 编辑 { title, times, odds_home_bps, odds_away_bps, status }
  - POST /api/v1/admin/markets/{id}/deactivate → 下架
  - POST /api/v1/admin/markets/{id}/settle → 结算 { winning_option, resolved_at }

- 订单管理
  - GET /api/v1/admin/orders?page&limit&status&user&market_id&date_range → 列表
  - GET /api/v1/admin/orders/{id} → 详情
  - POST /api/v1/admin/orders/{id}/cancel { reason }
  - POST /api/v1/admin/orders/{id}/settle { close_price, closed_at } → 计算 close_pnl 并更新 users.total_pnl

- 用户管理
  - GET /api/v1/admin/users?page&limit&q → 列表
  - GET /api/v1/admin/users/{id} → 详情
  - GET /api/v1/admin/users/{id}/stats → { total_pnl, balance, order_count }
  - PUT /api/v1/admin/users/{id}/status { status }
  - POST /api/v1/admin/users/{id}/blacklist ｜ /whitelist

- 审计日志
  - GET /api/v1/admin/audit?page&limit&actor&resource&date_range → 列表（基础版）

- 幂等与事务（建议）
  - 订单结算：事务更新 orders 与 users.total_pnl；重复请求返回当前状态。
  - 操作审计：所有写操作写入 audit_logs。

## 4. 前端页面（MVP）
- 路由结构
  - /admin/login → 登录页
  - /admin → Dashboard（简版）
  - /admin/markets → 列表/创建/编辑/上下架/结算
  - /admin/orders → 列表/详情/取消/结算
  - /admin/users → 列表/详情/状态与黑白名单
- 交互与组件
  - 列表支持筛选与分页；详情页提供操作按钮（二次确认）。
  - 赔率编辑支持 bps 与倍率（bps 入库，倍率仅展示）。
  - 表格列配置、导出 CSV（可后置）。
- 鉴权
  - 登录态保存（HttpOnly Cookie 或 localStorage）；登录失败与超时反馈。

## 5. 开发步骤（任务清单）
### Step A：基础鉴权与数据准备（Day 1）
- [后端] 新增 admin_users 与 audit_logs 迁移；插入首个管理员用户。
- [后端] 实现 /api/v1/admin/auth/login 与中间件；保护 /api/v1/admin/*。
- [前端] /admin/login 页面，表单与登录流程；登录后跳转 /admin。

### Step B：市场管理（Day 2）
- [后端] 实现市场管理接口（列表、详情、创建、编辑、下架、结算）。
- [前端] /admin/markets 列表页与创建/编辑弹窗；详情页操作按钮。
- [校验] 输入校验：时间范围、状态枚举、赔率区间；错误提示。
- [审计] 创建/编辑/下架/结算写 audit_logs。

### Step C：订单管理（Day 3）
- [后端] 实现订单管理接口（列表、详情、取消、结算）；结算事务更新 users.total_pnl。
- [前端] /admin/orders 列表与详情页；取消/结算弹窗与确认。
- [校验] 幂等保护：重复取消/结算返回当前状态；参数校验。
- [审计] 订单操作写 audit_logs。

### Step D：用户管理（Day 4）
- [后端] 实现用户管理接口（列表、详情、状态修改、黑白名单、统计）。
- [前端] /admin/users 列表与详情页；状态与黑白名单操作。
- [校验] 用户状态枚举校验；黑白名单规则（示例：黑名单不能下单）。
- [审计] 用户操作写 audit_logs。

### Step E：联调与验收（Day 5）
- [联调] 前后端联通与错误处理（统一错误码与提示）。
- [测试] 常规用例：
  - 市场创建/编辑/上下架/结算
  - 订单查询/取消/结算（含 close_price/close_pnl/closed_at）
  - 用户查询/状态修改/黑白名单与统计
- [验收] 按下文验收标准进行核验。

## 6. 验收标准（MVP）
- 登录成功并能访问 /admin 及其三大模块页面。
- 市场：
  - 能创建/编辑/上下架与结算市场；字段校验生效。
  - 列表筛选与分页在 200ms 内（测试数据 1w 条）。
- 订单：
  - 能查询列表与详情；取消与结算成功，结算事务更新 users.total_pnl。
  - 幂等：重复取消/结算请求不报错，返回最新状态。
- 用户：
  - 能查询列表与详情；状态修改与黑白名单操作生效。
  - stats 接口返回 total_pnl、balance、order_count。
- 审计：所有写操作在 audit_logs 留痕，可按 resource/actor 查询。

## 7. 风险与回退（MVP）
- 风险：错误结算或赔率操作影响用户权益；MVP 中以二次确认 + 审计回溯降低风险。
- 回退：保留操作记录与关键字段历史值；遇到异常手动回滚（SQL 或接口）。
- 性能：列表查询在数据量较大时可能性能不足；可通过索引优化与分页查询减少压力。

## 8. API 示例（片段）
```http
POST /api/v1/admin/auth/login
{ "email": "admin@kmarket.local", "password": "******" }
→ 200 { "token": "JWT" }

GET /api/v1/admin/markets?page=1&limit=20&status=active&q=premier
→ 200 { "items": [...], "pagination": { "page": 1, "limit": 20, "total": 100 } }

PUT /api/v1/admin/markets/123
{ "title": "EPL Match", "odds_home_bps": 18500, "odds_away_bps": 21000, "status": "active" }
→ 200 { "id": 123, ... }

POST /api/v1/admin/orders/567/cancel
{ "reason": "user_request" }
→ 200 { "id": 567, "status": "cancelled" }

POST /api/v1/admin/orders/567/settle
{ "close_price": 12.34, "closed_at": "2025-11-10T08:00:00Z" }
→ 200 { "id": 567, "status": "settled", "close_pnl": 2.34 }

GET /api/v1/admin/users/42/stats
→ 200 { "total_pnl": 123.45, "balance": 67.89, "order_count": 32 }
```

## 9. 实施建议与顺序
- 建议顺序：Step A → B → C → D → E（5 天完成 MVP）。
- 若时间紧张：
  - 把市场结算与订单结算放到最后一天集中联调；
  - 暂不做 CSV 导出与复杂筛选；
  - 审计仅保留关键写操作（订单取消/结算、市场结算、用户状态/黑白名单）。

---

如需我按此文档开始实现（先做 Step A 的后端登录接口与前端 /admin/login 页面），请确认，我将逐步提交对应的代码改动。