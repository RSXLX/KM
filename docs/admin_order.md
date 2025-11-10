需求分析

- 管理目标
  - 面向管理员对订单进行基础管理：查询列表、查看详情、取消、结算（并更新用户总盈亏）。
  - 保证结算为事务更新，避免部分更新导致数据不一致。
- 页面与功能
  - 列表页
    - 展示字段： id 、 order_id 、 wallet_address 、 market_id / fixture_id 、 amount @ odds 、 status 、 close_price/close_pnl
    - 分页与筛选：MVP 版支持分页（默认 20 条）与基础筛选参数（status、user 地址、market_id）
    - 操作：
      - 取消：状态改为 cancelled ，重复取消返回当前状态（幂等）
      - 结算：输入 close_price ，计算 close_pnl 并更新 users.total_pnl ；状态改为 settled
  - 详情页
    - MVP 版保留后端接口；前端详情弹窗可后续增加（当前先聚焦列表与操作）
- 数据一致性与事务
  - 结算事务步骤：
    - 读取订单 user_id 与 amount
    - 计算 close_pnl = close_price - amount
    - 更新订单（ status='settled' 、 closed_at 、 close_price 、 close_pnl ）
    - 更新用户 users.total_pnl += close_pnl
    - 写入审计日志并提交事务
  - 取消事务：
    - 幂等检查（已取消则返回当前状态）
    - 更新 status='cancelled' ，写入审计日志并提交事务
- 审计与可追溯
  - 所有写操作（取消/结算）写入 audit_logs （MVP actor_id=0 ；后续接入 JWT 守卫可填真实管理员 ID）
已完成的开发落地

- 后端（Actix + SQLx）
  - 新增文件： kmarket-backend/src/routes/admin_orders.rs
    - GET /api/v1/admin/orders ：订单列表（分页、status/user/market_id 筛选）
    - GET /api/v1/admin/orders/{id} ：订单详情
    - POST /api/v1/admin/orders/{id}/cancel ：取消（事务 + 幂等）
    - POST /api/v1/admin/orders/{id}/settle ：结算（事务更新 users.total_pnl ）
  - 已注册路由： src/main.rs 已加入 /api/v1/admin scope 中的 orders 路由
- 前端（Next.js App Router）
  - 代理路由
    - fronted/app/api/admin/orders/route.ts （GET 列表）
    - fronted/app/api/admin/orders/[id]/route.ts （GET 详情）
    - fronted/app/api/admin/orders/[id]/cancel/route.ts （POST 取消）
    - fronted/app/api/admin/orders/[id]/settle/route.ts （POST 结算）
  - 管理页面
    - fronted/app/admin/orders/page.tsx ：列表展示与操作
      - 取消：调用 /api/admin/orders/{id}/cancel
      - 结算：输入 close_price 后调用 /api/admin/orders/{id}/settle ，成功后刷新列表
预览与验证

- 管理登录： http://localhost:3000/admin/login （默认账号 admin@kmarket.local / admin123 ）
- 订单管理： http://localhost:3000/admin/orders
  - 验证列表加载
  - 对某条订单执行“取消”操作
  - 打开“结算”弹窗输入结算价格，确认结算，列表应显示 close_price/close_pnl 更新
- 后端服务（已运行）： http://localhost:8080 （读取 .env 中的 DATABASE_URL ，连接到你提供的数据库）
- 审计日志： audit_logs 中可以看到对应操作记录
注意与后续增强

- 结算公式：当前使用 close_pnl = close_price - amount ，可根据你的业务定义替换（例如考虑赔率与方向）
- 列表筛选：目前支持简单筛选，可扩展为时间范围与更多条件
- 详情页：后端已支持，前端可增加弹窗或独立详情页面
- 路由守卫：目前未启用严格的 JWT 校验（MVP），建议后续为 /api/v1/admin/* 加守卫并传入真实 actor_id
- 幂等性：取消与结算的重复请求有基本保护；建议引入 idempotency_key 增强防重