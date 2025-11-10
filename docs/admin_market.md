下面是 Step B「市场管理 MVP」的详尽需求分析与已完成的开发落地说明。你可以直接在浏览器访问 http://localhost:3000/admin/markets 进行体验（本地 Next.js dev 已启动；若遇到预览工具日志异常，可直接访问链接验证）。

需求分析

管理目标
高效管理当前市场的基本信息与生命周期，支持列表查询、创建、编辑、上下架、结算。
统一以业务主键 market_id 作为市场标识（同时保留数据库自增 id 用于内部操作）。
页面与功能
列表页
展示字段：id、market_id、title、status（枚举：pending/active/settled/cancelled）、option_a/option_b、odds_home_bps/odds_away_bps、start_time/end_time
分页与筛选：MVP 先实现基础分页与按 status/q（title/option_a/option_b 模糊）查询
操作：下架（取消）、结算（写入 winning_option→0/1），并刷新列表
创建弹窗
表单：market_id、title、option_a、option_b、start_time、end_time、status、odds_home_bps、odds_away_bps
校验：end_time 必须晚于 start_time，status 必须为枚举中的合法值
创建成功后刷新列表
编辑功能
MVP 版先在后端提供 PUT /admin/markets/{id}，前端编辑弹窗将作为下一步增强（当前先聚焦创建、下架、结算）
接口与数据一致性
所有写操作写入 audit_logs（MVP：actor_id=0，后续接入 JWT 守卫后注入真实管理员 ID）
事务与校验：
创建：唯一性由 market_id 约束；时间逻辑校验；状态枚举校验
下架：status 更新为 cancelled
结算：status 更新为 settled，写入 winning_option 与 resolved_at
ID 一致性：后端返回中同时包含 id 和 market_id；前端以数字格式显示
安全与权限（MVP）
当前不做严格 RBAC 与 JWT 路由守卫（已实现登录下发 JWT）；后续将对 /api/v1/admin/* 加守卫
性能与观测（MVP）
列表默认 20 条分页，索引：idx_markets_status、idx_markets_market_id 已存在
审计写入日志，便于后续回溯
已完成的开发落地

后端（Actix + SQLx）

新增管理员市场路由文件：kmarket-backend/src/routes/admin_markets.rs
GET /api/v1/admin/markets：列表与筛选（status，q），返回 items 与 pagination
POST /api/v1/admin/markets：创建，校验时间与状态枚举，自动填充 market_address=market_<market_id>
PUT /api/v1/admin/markets/{id}：编辑（MVP 支持部分字段更新，后续可拓展）
POST /api/v1/admin/markets/{id}/deactivate：下架，更新 status='cancelled'
POST /api/v1/admin/markets/{id}/settle：结算，更新 status='settled'、写入 winning_option 与 resolved_at
所有写操作插入 audit_logs（MVP：actor_id=0）
路由注册：kmarket-backend/src/main.rs 中 /api/v1/admin scope 下已注册上述路由
已保持数据库地址一致：kmarket-backend/.env 设置为你提供的地址（已启动成功并自动插入默认管理员）
前端（Next.js App Router）

管理入口页：/admin（已在之前的 Step A 实现）
管理员市场页：fronted/app/admin/markets/page.tsx
加载列表：GET /api/admin/markets（代理到后端）
新建市场：POST /api/admin/markets
下架：POST /api/admin/markets/{id}/deactivate
结算：POST /api/admin/markets/{id}/settle
代理路由：
fronted/app/api/admin/markets/route.ts（GET 列表，POST 创建）
fronted/app/api/admin/markets/[id]/route.ts（GET 详情：预留，PUT 更新）
fronted/app/api/admin/markets/[id]/deactivate/route.ts（POST 下架）
fronted/app/api/admin/markets/[id]/settle/route.ts（POST 结算）
验证与使用

管理登录：http://localhost:3000/admin/login（默认账号 admin@kmarket.local / admin123，已种子插入）
市场管理：http://localhost:3000/admin/markets
点击“新建市场”填表，创建后刷新列表看到新记录
对任意行点击“下架”、“结算A胜/结算B胜”验证状态变更
后端日志：所有写操作均在 audit_logs 记录，可用于后续追踪
后续增强建议（按优先级）

加路由守卫与 JWT 验证（将 /api/v1/admin/* 保护起来，并在审计写入真实 actor_id）
列表筛选增强（status/q、按 market_id 精确过滤、时间范围）
编辑弹窗（支持 title、option_a/b、时间、赔率的更新）
错误与校验文案优化（前端提交前校验时间格式与数值范围）
结算后联动：可选更新 close_time 或统计维度（如 total_bets、total_volume）