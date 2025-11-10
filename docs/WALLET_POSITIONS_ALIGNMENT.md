# 钱包-下注/持仓逻辑（前后端对齐方案）

本文梳理当前前端与后端在“钱包-下注（订单）/持仓（positions）”上的接口、字段与流程，给出对齐方案与可直接执行的 SQL，用于插入模拟数据并完成联调验证。

## 当前架构与路径约定

- 后端（Actix-Web，统一前缀）：`/api/v1`
  - 兼容输出（供前端消费的持仓结构）：
    - `GET /compat/users/{address}/positions`（支持筛选与分页）
    - `POST /compat/positions/open`（开仓）
    - `POST /compat/positions/close`（平仓/取消）
  - 统计：
    - `GET /users/{address}/stats`

- 前端（Next.js，本地 API 路由统一前缀）：`/api`
  - 聚合/代理接口（已合并）：
    - `GET /api/positions?wallet_address=...&status=current|history|all&fixture_id=...&page=1&limit=50`
      → 代理到后端 `GET /api/v1/compat/users/{address}/positions?...`
    - `POST /api/positions`（开仓）→ 代理到后端 `POST /api/v1/compat/positions/open`
    - `PATCH /api/positions`（管理动作，当前仅支持 `action=close`）→ 代理到后端 `POST /api/v1/compat/positions/close`
    - `POST /api/positions/close`（保留旧路径，效果同上）
    - `GET /api/users/stats?wallet_address=...` → 代理到后端 `GET /api/v1/users/{address}/stats`

> 注意：前端调用“本地 API”路径必须使用 `/api/...`，不要与 `NEXT_PUBLIC_API_BASE_URL` 叠加，否则会生成错误的 `/api/v1/api/...` 路径并导致 404。我们已在 `apiClient` 中增加防呆：当 path 以 `/api/` 开头时，直接同源调用而不再叠加 baseUrl。

## 数据结构与字段映射

- 后端兼容视图 `positions_v`（来源：`orders` JOIN `users` JOIN `markets`）输出 `FrontendPosition` 结构的核心字段：
  - `id, user_id, market_id, wallet_address, market_address, selected_team(1/2), amount, multiplier_bps, status(1/2/4...), timestamp, created_at, updated_at ...`
  - `status` 映射：`placed→1（当前）`、`settled→2（已结算）`、`cancelled→4（取消）`
  - `multiplier_bps = ROUND(odds * 10000)`；`selected_team = (option=0?1:2)`

- 前端期望（示例：`/app/account/positions/page.tsx`、`/components/sports/MyBet.tsx`）：
  - 读取 `positions[]`，并按 `position_type/status` 划分“当前持仓/历史持仓”。
  - 可选字段：`payout_expected`、`odds_home_bps/odds_away_bps`、嵌套 `market`（`home_team/away_team/fixture_id/status`）。当前后端未直接返回这些“丰富字段”。
  - 前端已做容错（例如 `MyBet` 在没有 `market.home_team/away_team` 时使用“主队/客队”占位）。

## 差异与影响

- 路径差异：已通过前端 `apiClient` 防呆修复，避免生成 `/api/v1/api/...`。
- 字段差异：后端目前未直接输出 `fixture_id（markets.market_id）`、`home_team/away_team（markets.home_name/away_name）`、`payout_expected`、`odds_home_bps/odds_away_bps`。
  - 影响：前端在一些卡片或列表上需要显示队伍名称/预计赔付/赔率；现阶段能工作但展示信息不完整或需要占位符。
- 状态字典差异：前端有更丰富的状态标签（如 1~6 范围），后端当前只覆盖常用三类（当前/已结算/取消）。

## 对齐方案（推荐）

### 后端（SQL 视图与接口）

1) 丰富 `positions_v` 的输出字段，加入市场信息与期望赔付：

```sql
CREATE OR REPLACE VIEW positions_v AS
SELECT
  o.id AS id,
  o.user_id AS user_id,
  o.market_id AS market_id,
  u.address AS wallet_address,
  m.market_address AS market_address,
  m.market_id AS fixture_id,
  m.home_name AS home_team,
  m.away_name AS away_team,
  o.id AS nonce,
  'OPEN'::TEXT AS position_type,
  CASE WHEN o.option = 0 THEN 1 ELSE 2 END AS selected_team,
  o.amount::NUMERIC AS amount,
  ROUND(o.odds * 10000)::INT AS multiplier_bps,
  m.odds_home_bps AS odds_home_bps,
  m.odds_away_bps AS odds_away_bps,
  (o.amount * o.odds)::NUMERIC AS payout_expected,
  CASE o.status WHEN 'placed' THEN 1 WHEN 'cancelled' THEN 4 WHEN 'settled' THEN 2 ELSE 1 END AS status,
  FALSE AS is_claimed,
  0::NUMERIC AS pnl,
  0::NUMERIC AS fee_paid,
  NULL::NUMERIC AS close_price,
  NULL::NUMERIC AS close_pnl,
  o.created_at AS timestamp,
  o.created_at AS created_at,
  o.updated_at AS updated_at,
  NULL::TIMESTAMPTZ AS closed_at,
  NULL::TEXT AS transaction_signature,
  NULL::BIGINT AS block_slot,
  'pending'::TEXT AS confirmation_status
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN markets m ON m.id = o.market_id;
```

2) 兼容查询接口 `GET /api/v1/compat/users/{address}/positions`：
  - 已支持 `status`（`current|history|all|open|closed`）、`fixture_id`（数字匹配 `market_id`，否则匹配 `market_address`）、`page`、`limit`。
  - 返回统一结构：`{ positions: [...], pagination: { page, limit, total, total_pages } }`。

3) 统计接口 `GET /api/v1/users/{address}/stats`：
  - 维持现有实现；后续可扩展口径（如 `win_rate/fees_paid/open_volume`），与前端显示项对齐。

### 前端（Next API 与页面）

1) 保持使用本地 API 路径（`/api/...`）并避免叠加 `NEXT_PUBLIC_API_BASE_URL`：
  - `GET /api/positions` → 后端 `compat/users/{address}/positions`
  - `POST /api/positions`（开仓）→ 后端 `compat/positions/open`
  - `PATCH /api/positions`（平仓）→ 后端 `compat/positions/close`
  - `GET /api/users/stats` → 后端 `users/{address}/stats`

2) 页面统一：`/account/bets` 已重定向到 `/account/positions`，在一个页面完成“当前持仓/历史持仓”的展示与管理（开/平仓）。

3) 展示与容错：
  - 读取 `positions[]`，优先显示 `home_team/away_team/fixture_id`；若缺失则使用占位字符串。
  - `selected_team (1/2)` 映射到 `'home'/'away'` 用于 UI。
  - `payout_expected` 若不存在则前端用 `amount * odds * (multiplier_bps/10000)` 计算。

## 模拟数据 SQL（可直接执行）

用于插入一个钱包、两场比赛与两条订单（一个当前、一个历史），`positions_v` 将自动生成持仓数据。

```sql
BEGIN;

-- 1) 插入用户（钱包地址）
INSERT INTO users (address, status)
VALUES ('9PukwsysGRaSeJYiU3y1frVvqZx69P8xGvXVwFe6MkQ2', 'active')
ON CONFLICT (address) DO NOTHING;

-- 2) 插入两个市场（EPL、NBA）
INSERT INTO markets (
    market_id, title, description, option_a, option_b,
    start_time, end_time, status,
    market_address, home_name, away_name, state, result,
    odds_home_bps, odds_away_bps
)
VALUES
    (
      (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT,
      'Arsenal vs Chelsea', 'EPL Round', 'Arsenal', 'Chelsea',
      NOW(), NOW() + INTERVAL '2 hours', 'active',
      'fixture_epl_001', 'Arsenal', 'Chelsea', 1, 0,
      18500, 20500
    ),
    (
      (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT + 1,
      'Lakers vs Heat', 'NBA Regular', 'Lakers', 'Heat',
      NOW(), NOW() + INTERVAL '3 hours', 'active',
      'fixture_nba_001', 'Lakers', 'Heat', 1, 0,
      19500, 19000
    );

-- 3) 为该钱包插入两条订单（映射为持仓）
WITH u AS (
  SELECT id FROM users WHERE address = '9PukwsysGRaSeJYiU3y1frVvqZx69P8xGvXVwFe6MkQ2' LIMIT 1
),
m_epl AS (
  SELECT id FROM markets WHERE market_address = 'fixture_epl_001' LIMIT 1
),
m_nba AS (
  SELECT id FROM markets WHERE market_address = 'fixture_nba_001' LIMIT 1
)
-- 当前持仓：EPL，主队，赔率1.85，状态 placed
INSERT INTO orders (order_id, user_id, market_id, amount, odds, option, status)
SELECT
  (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT, u.id, m_epl.id,
  10.0, 1.85, 0, 'placed'
FROM u, m_epl;

-- 历史持仓：NBA，客队，赔率1.95，状态 settled
INSERT INTO orders (order_id, user_id, market_id, amount, odds, option, status)
SELECT
  (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT + 1, u.id, m_nba.id,
  12.5, 1.95, 1, 'settled'
FROM u, m_nba;

COMMIT;
```

快速验证：

```sql
SELECT id, wallet_address, fixture_id, home_team, away_team, selected_team, amount, multiplier_bps, status, created_at
FROM positions_v
WHERE wallet_address = '9PukwsysGRaSeJYiU3y1frVvqZx69P8xGvXVwFe6MkQ2'
ORDER BY created_at DESC;
```

## 联调与测试用例

- 后端直连：
  - 持仓：`GET /api/v1/compat/users/{address}/positions?status=current&page=1&limit=50`
  - 统计：`GET /api/v1/users/{address}/stats`
- 前端代理：
  - 持仓：`GET /api/positions?wallet_address={address}&status=current&page=1&limit=50`
  - 开仓：`POST /api/positions { wallet_address, market_address, selected_team, amount, multiplier_bps }`
  - 平仓：`PATCH /api/positions { action: 'close', position_id }`

## 迭代建议（可选）

- 状态字典统一：在后端扩展 `status` 映射以覆盖前端的 1~6 标签，并在响应中追加 `status_label`/`status_text` 便于前端直接显示。
- 并发与一致性：开/平仓接口已通过仓储层事务与版本控制；建议在高并发场景下增加冲突重试或返回 `expected_version` 以指导前端二次提交。
- 展示优化：返回更多市场维度（`league/sport/kickoff`）以支持筛选与分类；或提供 `/api/v1/compat/markets` 联表接口以一次性获取“持仓+市场详情”。

---

如需将上述 `positions_v` 变更直接落库，我可以提供对应迁移脚本或在运行态（`state.rs`）中自动对视图进行 `CREATE OR REPLACE`，并在日志中输出校验信息，保证兼容升级与回滚安全。