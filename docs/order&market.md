# 市场与订单模块全面梳理
## 1. 核心业务功能
- 市场模块
  
  - 上架/创建：通过后端 CreateMarket（表：markets）创建业务主键 market_id 的市场条目，包含 title/description、选项（option_a/option_b）、start_time、end_time、status（枚举：pending/active/settled/cancelled）。
  - 浏览与搜索：后端提供 /api/v1/sports/fixtures（前端经 /api/sports/fixtures 代理），支持 status/sport/league/q 分页查询；也可扩展 /api/markets 列表与详情。
  - 价格发现（赔率）：以 odds_home_bps/odds_away_bps（bps → 倍率）呈现盘口，前端展示 preOdds/liveOdds；支持动态更新逻辑（风控/撮合）扩展。
  - 市场统计：markets 表含 total_volume、total_bets、current_exposure、max_exposure 等字段，用于交易量与风险敞口统计。
  - 上下架与结算：通过 market_status 管理生命周期，配 resolved_at/close_time 标记结算与关闭。
- 订单模块
  
  - 创建：/api/v1/orders 或兼容路由 /api/positions，状态初始 placed，记录 user_id、market_id、amount、odds、option（0/1）。
  - 取消：更新为 cancelled，并写审计（可选，order_audits）。
  - 成交/结算：更新为 settled，记录 closed_at、close_price、close_pnl（已在 0008_close_fields.sql 支持）。
  - 平仓/关闭：新增 close_* 字段，positions_v 视图映射这些字段（便于前  端统一查询）。
  - 用户统计：users 表含 total_pnl、balance 字段，配 /users/{address}/stats 或聚合视图，跟踪盈亏与余额。
  - 争议处理：可在订单审计与人工仲裁流程中补充（当前未显式实现）。
## 2. 关键数据结构与状态模型
- 市场（markets）
  
  - 核心属性：id（自增）、market_id（业务主键）、title、description、option_a/option_b、start_time、end_time、status（枚举）、winning_option、created_at/updated_at。
  - 前端对齐字段（0006_align_frontend.sql）：market_address、home_code/away_code、home_name/away_name、close_time、state（int）、result（int）、odds_home_bps/odds_away_bps、max_exposure/current_exposure/total_volume/total_bets、resolved_at。
  - 枚举：market_status = ('pending','active','settled','cancelled')。
- 订单（orders）
  
  - 核心属性：id、order_id（唯一）、user_id、market_id（FK→markets.id）、amount、odds、option（0/1）、status（order_status='placed','cancelled','settled'）、created_at/updated_at。
  - 平仓字段（0008_close_fields.sql）：closed_at、close_price、close_pnl。
  - 视图映射：positions_v 将订单行转换为前端统一结构（wallet_address、market_address、position_type、selected_team、multiplier_bps、close_* 等）。
- 视图（views）
  
  - sports_fixtures_v：为前端返回 fixtures 列表（建议 id = market_id::TEXT），包含 title/sport/league/home_team/away_team/kickoff_time/status/pre_odds/live_odds。
  - positions_v：订单统一视图，支持 open/close 字段、pnl、confirmation_status 等。
- 订单状态机（建议）
  
  - placed → cancelled｜settled
  - 可扩展中间态：processing（链上验证中）、failed（链上失败），用于更精细区分链上/链下状态。
- 链上 vs 链下状态
  
  - 链下：DB 中 orders.status、close_* 为权威，支持补偿与审计。
  - 链上：交易签名与确认（transaction_signature、block_slot、confirmation_status）作为扩展字段，异步校验，不阻塞订单落库。
## 3. 前后端职责与协作机制
- 前端
  
  - 用户交互、钱包签名或交易提交（wallet-ledger/solana-ledger.ts）。
  - 构造订单请求：payload 使用 fixture_id（= market_id，字符串或数字均可）并兼容 market_address。
  - 显示订单状态与赔率，处理 pending 与 timeout；通过 WebSocket 或轮询获取变更。
  - ID 统一：以 fixture_id=market_id 为主，兼容 market_
    前缀；useSportsBetting.ts 当前以字符串 fid 工作正常。
- 后端
  
  - 市场查找：优先按 fixture_id=market_id，再按 market_address。必要时自动插入 stub 市场，减少 MARKET_NOT_FOUND。
  - 订单持久化：参数校验、写入 orders；审计（可选）。
  - 风控：限额与风险敞口（max_exposure/current_exposure）、重复下单防御、用户黑白名单。
  - 异步链上校验：保存交易签名（可选）、消息队列或事件监听确认并更新状态。
  - 聚合与推送：统计维护、视图生成、WebSocket 推送变更。
## 4. 实时性与一致性保障
- WebSocket 推送
  
  - 通道 /ws，topic 按 user_id/address 或 market_id；推送订单状态与赔率变更。
  - 心跳与重连：前端心跳保活，断线自动重连，后端支持 session 恢复。
- 幂等性与唯一性
  
  - 使用 order_id 或 idempotency_key 作为幂等键；后端在唯一约束上 UPSERT 或返回已有记录。
  - 前端重试时保留相同 idempotency_key，避免重复下单。
- 事务与补偿
  
  - 创建订单使用事务（orders + 审计）。
  - 链上失败补偿：标记 failed 或保持 placed，提供取消/重试入口。
  - Outbox 模式：订单写入后写出待推送事件，独立消费者可靠推送。
- 重试与恢复
  
  - 钱包校验采用指数退避；记录错误码与状态（LEDGER_TIMEOUT/ECONNREFUSED）。
  - 服务启动恢复扫描：对 processing 订单重新校验或标记需人工处理。
## 5. 潜在瓶颈与优化方向
- 高并发下单：连接池与 pgbouncer、索引优化（orders 与 markets 相关索引）、写路径限流（按 user_id/market_id）。
- 频繁查询：视图缓存（物化视图或 Redis）、分页与字段裁剪（简版/详情版接口）。
- 搜索：pg_trgm/TSVector 或外置搜索引擎。
- 观测：tracing + metrics，慢查询日志与 SQL 优化。
## 6. 可扩展性
- 多资产类型：在 markets 增加 asset_type（sports/NFT/service），不同属性用 JSONB（metadata）。
- 多链：增加 chain_id/network；钱包校验模块适配器化（EVM/Solana/其他）。
- 撮合升级：自动盘口调节、风控模板（阈值/限额/黑白名单）、A/B 实验。
- ID 统一：前后端使用 fixture_id=market_id（字符串），保留 market_address 兼容。
## 7. 用户体验优化
- 状态反馈：下单后展示处理中与重试入口；链上校验超时不阻塞落库。
- 异常恢复：弱网/后端异常提示与自动重试；已落库订单自动恢复状态。
- 错误码统一：MARKET_NOT_FOUND、LEDGER_TIMEOUT、POOL_TIMEOUT 等明确文案。
## 8. 伪代码示例（订单创建：幂等 + 异步校验）
```
POST /api/v1/orders
payload: { user_id, fixture_id, 
amount, odds, option, 
idempotency_key, 
transaction_signature? }

tx begin
  existing = select * from orders 
  where idempotency_key = $key
  if existing: return existing
  insert into orders (user_id, 
  market_id_from_fixture_id, 
  amount, odds, option, 
  status='placed', idempotency_key)
  insert into outbox (event='order.
  created', order_id)
tx commit

async-consumer:
  if transaction_signature:
    verify on-chain -> update 
    orders.confirmation_status
  push websocket event "order.
  created" to user/topic
```
————————————