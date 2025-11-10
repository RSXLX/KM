# 管理员端建设方案（基于现有架构）
## 1. 目标与范围
- 目标：提供运营/风控/客服等角色的管理后台，支持市场与订单的全生命周期管理、风控配置、统计报表与实时监控。
- 范围：
  - 市场管理：创建/编辑/上下架、赔率维护、限额配置、统计查看。
  - 订单管理：查询/筛选、取消/结算、争议处理、审计追踪。
  - 用户管理：用户信息与状态、余额/盈亏、黑白名单。
  - 运营支持：公告、工单、异常处理。
  - 监控与报表：订单流量、成交转化、PNL、风险敞口、慢查询与错误。
## 2. 角色与权限（RBAC）（先不加权限）
- 角色
  
  - Admin（超级管理员）：系统配置、角色分配、敏感操作全权限。
  - Operator（运营）：市场与订单日常操作、赔率调整。
  - Analyst（分析员）：查看报表与日志，无写权限。
  - Support（客服）：查看订单与用户、处理工单，受限的订单操作（需审批）。
- 权限资源
  
  - markets:*（list/create/update/deactivate/settle）
  - orders:*（list/cancel/settle/dispute-view/dispute-resolve）
  - users:*（list/update-status/blacklist/whitelist）
  - config:*（odds-template/risk-rule）
  - reports:*（view-export）
  - audit:*（view）
  - system:*（role/permission）
- 数据表（建议新增）
  
  - admin_users(id, email, password_hash, salt, status, created_at, updated_at)
  - roles(id, name, description)
  - permissions(id, resource, action)
  - admin_user_roles(admin_user_id, role_id)
  - role_permissions(role_id, permission_id)
  - audit_logs(id, actor_id, action, resource, resource_id, payload_json, created_at)
## 3. 后端接口设计（Actix + SQLx）
- 鉴权与中间件
  
  - 管理员登录：POST /api/v1/admin/auth/login → 返回 JWT（短有效期）与 refresh token。
  - 守卫：AdminAuthMiddleware 校验 JWT 并加载角色/权限。
- 市场管理
  
  - GET /api/v1/admin/markets?page=&limit=&status=&q=
  - POST /api/v1/admin/markets { market_id, title, option_a, option_b, start_time, end_time, status }
  - PUT /api/v1/admin/markets/{id} { title, times, status, odds_home_bps, odds_away_bps, limits... }
  - POST /api/v1/admin/markets/{id}/deactivate
  - POST /api/v1/admin/markets/{id}/settle { winning_option, resolved_at }
  - GET /api/v1/admin/markets/{id}/stats
- 订单管理
  
  - GET /api/v1/admin/orders?page=&limit=&status=&user=&market_id=&date_range=
  - POST /api/v1/admin/orders/{id}/cancel { reason }
  - POST /api/v1/admin/orders/{id}/settle { close_price, close_pnl, closed_at } → 同步 users.total_pnl
  - GET /api/v1/admin/orders/{id}/audit
- 用户管理
  
  - GET /api/v1/admin/users?page=&limit=&q=
  - PUT /api/v1/admin/users/{id}/status { status }
  - POST /api/v1/admin/users/{id}/blacklist
  - POST /api/v1/admin/users/{id}/whitelist
  - GET /api/v1/admin/users/{id}/stats
- 配置与风控
  
  - GET /api/v1/admin/config/odds-templates
  - POST /api/v1/admin/config/odds-templates
  - GET /api/v1/admin/config/risk-rules
  - POST /api/v1/admin/config/risk-rules
- 审计与报表
  
  - GET /api/v1/admin/audit?page=&limit=&actor=&resource=&date_range=
  - GET /api/v1/admin/reports/overview?range=
  - GET /api/v1/admin/reports/pnl?range=
- WebSocket 推送
  
  - /ws/admin：接收订单状态、赔率变更、系统告警；支持按角色/资源订阅。
- 幂等与事务
  
  - 所有写操作包含 idempotency_key（前端生成或后端分配）。
  - 订单与市场更新采用事务；写入 audit_logs。
## 4. 前端管理后台（Next.js App Router）
- 入口与路由结构
  
  - /admin（Dashboard）
  - /admin/markets（列表/创建/编辑）
  - /admin/orders（列表/详情/操作）
  - /admin/users（列表/详情/黑白名单）
  - /admin/reports（PNL/成交/风控）
  - /admin/audit（审计日志）
  - /admin/settings（角色与权限管理）
- 页面与交互
  
  - 列表页：可组合筛选（status/user/market_id/date_range/q）、导出 CSV、列配置。
  - 编辑表单：校验与预览、赔率编辑（bps→倍率可视化）、时间选择。
  - 详情页：订单详情含时间线（创建→取消/结算）、审计记录、链上信息（如有）。
  - 实时更新：WebSocket 订阅对应频道，提示最新变更（小红点/Toast/可选声音）。
- 组件与库
  
  - UI：shadcn/ui 或 Ant Design，DataGrid 表格组件。
  - 图表：Recharts/ECharts（PNL、订单量、转化漏斗）。
  - 鉴权：JWT 存储（HttpOnly Cookie + CSRF 防护），或集成 NextAuth（Credentials Provider）。
## 5. 数据一致性与可靠性（管理员端侧重点）
- 审批流（可选）先不做
  - 敏感操作（结算、取消、赔率大幅调整）需两人审批；引入 approval_flows 表与状态。
- 事件总线与回放
  - 管理端写操作产生日志与事件（outbox），保证可回放与追责。
- 灰度与操作日志
  - 赔率调整、市场结算允许灰度（部分市场、部分用户）；所有操作写入 audit_logs。
## 6. 部署与配置
- 环境变量
  - ADMIN_JWT_SECRET、ADMIN_REFRESH_SECRET
  - ADMIN_SESSION_TTL、ADMIN_REFRESH_TTL
  - DATABASE_URL、PGBouncer（可选）
- 安全
  - 强密码策略与 2FA（可选）
  - IP 白名单与操作限流
  - 敏感接口审计与报警（Slack/Feishu Webhook）
## 7. 实施步骤（分阶段）
### Phase 0：基础设施与鉴权（Week 1）

- 数据库迁移
  - 建表：admin_users(id, email, password_hash, salt, status, created_at, updated_at)
  - 建表：roles(id, name, description)、permissions(id, resource, action)
  - 关联：admin_user_roles(admin_user_id, role_id)、role_permissions(role_id, permission_id)
  - 审计：audit_logs(id, actor_id, action, resource, resource_id, payload_json, created_at)
  - 索引：idx_admin_users_email、idx_audit_logs_resource、idx_audit_logs_actor
- 后端鉴权与中间件
  - 路由：POST /api/v1/admin/auth/login、POST /api/v1/admin/auth/refresh、POST /api/v1/admin/auth/logout
  - 中间件：AdminAuthMiddleware（校验 JWT、加载角色/权限；首期支持无权限校验，仅登录态）
  - 密码策略：bcrypt/argon2 加密、最短长度与复杂度校验
  - 会话：JWT 有效期 30m、Refresh Token 7d、HttpOnly Cookie（可选）
  - 审计：登录成功/失败写入 audit_logs
- 前端登录页与基本框架
  - /admin/login：表单（邮箱、密码）、错误反馈、登录态存储（Cookie 或 localStorage）
  - /admin：基础布局（侧边栏、头部、权限占位）
- 灰度与风控
  - 限流：/api/v1/admin/auth/login 每 IP 每分钟 10 次
  - IP 白名单（可选，环境变量）
- 交付与验收
  - 能创建首个管理员用户（seed 或脚本）并成功登录
  - /api/v1/admin/* 路由默认要求登录态
  - 审计日志可查询（基础 SQL 或接口）

### Phase 1：市场管理（Week 2）

- 后端接口
  - GET /api/v1/admin/markets?page&limit&status&q（列表与筛选）
  - POST /api/v1/admin/markets（创建：market_id、title、option_a/b、start/end、status）
  - PUT /api/v1/admin/markets/{id}（编辑：时间、状态、odds_home_bps/odds_away_bps、限额）
  - POST /api/v1/admin/markets/{id}/deactivate（下架）
  - POST /api/v1/admin/markets/{id}/settle（结算：winning_option、resolved_at）
  - GET /api/v1/admin/markets/{id}/stats（统计：total_bets、total_volume、current_exposure 等）
- 前端页面
  - 列表页：筛选（status/q）、排序（kickoff/resolved）、批量操作（下架）
  - 创建/编辑弹窗：表单校验、时间选择器、赔率编辑（bps→倍率可视化）
  - 详情页：基本信息、历史变更、统计概览
- 数据与校验
  - market_id 唯一校验；start_time < end_time；status 属于枚举
  - 赔率范围校验：0.5~10.0（示例），bps 存库，倍率用于展示
  - 审计：创建/编辑/下架/结算全部记录 audit_logs
- 观测与推送
  - WebSocket topic: admin.markets（市场状态/赔率变更推送）
- 验收标准
  - 能创建、编辑并上下架市场；结算后状态与统计正确
  - 列表筛选性能在 50ms~200ms（测试数据规模 1~5 万条）

### Phase 2：订单管理（Week 3）

- 后端接口
  - GET /api/v1/admin/orders?page&limit&status&user&market_id&date_range
  - GET /api/v1/admin/orders/{id}（详情）
  - POST /api/v1/admin/orders/{id}/cancel { reason }
  - POST /api/v1/admin/orders/{id}/settle { close_price, closed_at } → 计算 close_pnl 并更新 users.total_pnl
  - GET /api/v1/admin/orders/{id}/audit（审计记录）
- 前端页面
  - 列表页：多条件筛选、导出 CSV、列配置
  - 详情页：时间线（创建→取消/结算）、链上字段（如交易签名/确认状态）、审计列表
  - 操作：取消/结算带确认弹窗与说明
- 逻辑与一致性
  - close_pnl = close_price - amount（或按业务公式调整）
  - 事务：订单更新与用户 total_pnl 更新同事务提交
  - 幂等：对重复取消/结算请求返回当前状态
  - 审计：每次操作写入 audit_logs
- 推送与观测
  - WebSocket topic: admin.orders（订单状态变更推送）
- 验收标准
  - 大批量分页查询无超时（索引命中）
  - 操作日志完整；用户 PnL 聚合一致

### Phase 3：用户管理与风控（Week 4）

- 后端接口
  - GET /api/v1/admin/users?page&limit&q
  - GET /api/v1/admin/users/{id}/stats（total_pnl、balance、订单数）
  - PUT /api/v1/admin/users/{id}/status { status }
  - POST /api/v1/admin/users/{id}/blacklist｜whitelist
  - GET /api/v1/admin/risk/rules｜POST /api/v1/admin/risk/rules（先提供模板存储，不做审批）
- 前端页面
  - 列表页：基本信息、筛选、黑白名单标识
  - 详情页：用户画像、盈亏曲线、最近订单
  - 操作：封禁/解封、加白、编辑风控模板
- 风控落地（基础版）
  - 开仓路由（兼容 /api/positions）：在后端增加风控校验（黑名单拒绝、限额检查）
  - 指标：按用户/市场的下单频次与金额阈值，触发警告并写审计
- 验收标准
  - 黑白名单生效；风控规则能阻断不合规下单

### Phase 4：报表与监控（Week 5）

- 报表接口
  - GET /api/v1/admin/reports/overview?range（订单量、成交率、转化漏斗）
  - GET /api/v1/admin/reports/pnl?range（盈亏统计按日/市场/用户维度）
  - 导出：CSV/Excel（前端触发后端生成或前端整理）
- 监控与告警
  - 指标：请求耗时、错误率、慢查询（>200ms）、WebSocket 在线数
  - 告警：Slack/飞书 webhook；阈值可配置（环境变量）
- 前端可视化
  - Dashboard：卡片式指标、趋势图、TopN 排行
  - 图表：Recharts/ECharts，支持区间选择与对比
- 验收标准
  - 报表在数据量 10w+ 时仍可用（必要时采用预聚合/缓存）
  - 告警触发与通知链路可用

### Phase 5：灰度与审批流（增强）（Week 6+ 可选）

- 审批流（先不强制启用，方案预留）
  - 建表：approval_flows(id, flow_name)、approval_tasks(id, flow_id, actor_id, action, resource, resource_id, status)
  - 接口：POST /api/v1/admin/approvals/...（创建/同意/拒绝）
  - 集成：敏感操作（结算、赔率大幅调整）进入审批流
- 灰度发布
  - 对赔率调整与结算支持按市场/用户分组灰度
  - 版本化：变更记录可回滚（保留历史版本）
- 告警与回退
  - 敏感动作触发二次确认与告警；出错快速回滚到上一个版本
- 验收标准
  - 审批流能串起至少两人流程；灰度规则可配置与生效

### 交付节奏与协作机制

- 每周里程碑：后端接口 + 前端页面 + 文档与测试用例
- Code Review：两人互审；单元测试覆盖关键路径（市场创建、订单结算、风控拦截）
- 文档更新：/docs/admin.md 与 /docs/API.md 持续补充
- 演示与验收：周会演示最新模块，验收标准按上文每阶段列出
## 8. 示例接口定义（片段）
```
POST /api/v1/admin/auth/login
{
  "email": "admin@kmarket.local",
  "password": "******"
}
→ 200 { "token": "JWT", 
"refreshToken": "..." }

GET /api/v1/admin/markets?page=1&
limit=20&status=active&q=premier
→ 200 { "items": [...], 
"pagination": { "page": 1, "limit": 
20, "total": 100 } }

PUT /api/v1/admin/markets/123
{ "title": "EPL Match", 
"odds_home_bps": 18500, 
"odds_away_bps": 21000, "status": 
"active" }
→ 200 { "id": 123, ... }

POST /api/v1/admin/orders/567/cancel
{ "reason": "user_request" }
→ 200 { "id": 567, "status": 
"cancelled" }

POST /api/v1/admin/orders/567/settle
{ "close_price": 12.34, 
"closed_at": 
"2025-11-10T08:00:00Z" }
→ 200 { "id": 567, "status": 
"settled", "close_pnl": 2.34 }
```
## 9. 风险与回退策略
- 风险：错误赔率或错误结算影响用户权益；采取审批与灰度，所有变更可审计与回放。
- 回退：所有配置变更保留历史版本，可快速回滚；对影响范围进行标记并通知。
- 监控：操作频次异常、失败率升高触发告警；敏感动作记录详细上下文与签名。
