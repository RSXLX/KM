# 用户账户与持仓 API 文档

> 文件编码：UTF-8

- 本文档记录前端代理层（Next.js `/api/*`）与后端服务（Actix `/api/v1/*`）中，所有与“用户账户”和“持仓”相关的接口、数据结构、调用示例与错误代码。
- 适用于开发环境（本地）与生产环境（线上），并标注环境 URL 差异与配置方法。

## 目录

- [接口概览](#接口概览)
- [数据结构说明](#数据结构说明)
  - [账户信息数据结构](#账户信息数据结构)
  - [持仓信息数据结构](#持仓信息数据结构)
  - [响应示例](#响应示例)
- [接口调用示例](#接口调用示例)
- [错误代码表](#错误代码表)

---

## 接口概览

下表列出了与“用户账户”和“持仓”相关的所有 API 端点，包括前端代理与后端服务。请按需选择调用层：

- 前端代理层（推荐前端页面与客户端调用）：`http://localhost:3000/api/...`
- 后端服务层（服务端或工具直接调用）：`http://localhost:8080/api/v1/...`（默认测试环境）

> 生产环境与测试环境的 URL 差异：
>
> - 测试环境（本地）：
>   - 前端：`http://localhost:3000/api/...`
>   - 后端：`http://localhost:8080/api/v1/...`
>   - 通过环境变量 `NEXT_PUBLIC_API_BASE_URL` 控制后端 Base：见 `fronted/.env.example`
> - 生产环境（示例）：
>   - 前端：`https://your-frontend-domain.com/api/...`
>   - 后端：`https://api.your-backend-domain.com/api/v1/...`
>   - 将 `NEXT_PUBLIC_API_BASE_URL` 设置为后端生产地址（含 `/api/v1`）

### 前端代理层（Next.js `/api/*`）

| 接口名称 | 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|---|
| 查询用户持仓 | GET | `/api/positions?wallet_address=...&status=&fixture_id=&page=&limit=` | 无 | 代理后端用户持仓列表，支持分页与筛选。后端 404 会在前端映射为空列表并返回 200。|
| 创建持仓（开仓） | POST | `/api/positions` | 无 | 代理后端创建持仓，传入必要字段（见下文数据结构）。|
| 关闭持仓（动作路由） | PATCH | `/api/positions` | 无 | 传入 `{ action: 'close', position_id }` 代理后端关闭持仓。|
| 关闭持仓（专用路由） | POST | `/api/positions/close` | 无 | 同上，POST 封装到后端 `compat/positions/close`。|
| 用户统计 | GET | `/api/users/stats?wallet_address=...` | 无 | 代理后端用户统计。后端 404 会在前端映射为“零统计”并返回 200。|
| 兼容旧路径（别名） | GET | `/api/bets?wallet_address=...` | 无 | 重定向到 `/api/positions` 的兼容端点。|

> 说明：部分管理类接口（如 `/api/admin/*`）需要 `Authorization: Bearer <token>`，本文档聚焦用户账户与持仓，无需认证。

### 后端服务层（Actix `/api/v1/*`）

| 接口名称 | 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|---|
| 查询用户持仓 | GET | `/api/v1/compat/users/{wallet_address}/positions?status=&fixture_id=&page=&limit=` | 无 | 返回用户持仓列表与分页信息。|
| 创建持仓（开仓） | POST | `/api/v1/compat/positions` | 无 | 创建持仓，需传入规范化字段。|
| 关闭持仓 | POST | `/api/v1/compat/positions/close` | 无 | 关闭指定持仓。|
| 用户统计 | GET | `/api/v1/users/{wallet_address}/stats` | 无 | 返回用户账户统计信息。|

---

## 数据结构说明

### 账户信息数据结构

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `total_positions` | `number` | 总持仓数 | `42` |
| `open_positions` | `number` | 开仓中数量 | `3` |
| `closed_positions` | `number` | 已关闭数量 | `39` |
| `won_positions` | `number` | 赢的持仓数量 | `21` |
| `lost_positions` | `number` | 输的持仓数量 | `18` |
| `total_volume` | `number` | 累计交易量（原始单位） | `1200000000` |
| `total_pnl` | `number` | 累计盈亏（原始单位） | `-34000000` |
| `total_fees_paid` | `number` | 累计手续费（原始单位） | `5600000` |
| `win_rate` | `number` | 胜率（0-1） | `0.538` |

> 注：前端页面可根据业务需要将原始单位换算（例如 Lamports → SOL）。

### 持仓信息数据结构

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `id` | `number` | 持仓ID | `1001` |
| `wallet_address` | `string` | 用户钱包地址 | `AyWoecj5WdNCVG...` |
| `market_address` | `string` | 市场地址 | `MarketXYZ123` |
| `bet_address` | `string?` | 下注记录地址（可选） | `BetABC456` |
| `position_type` | `'OPEN' | 'CLOSE'` | 持仓类型 | `OPEN` |
| `selected_team` | `number` | 选择的队伍（A/B） | `1` |
| `amount` | `number` | 下注金额（原始单位） | `500000000` |
| `multiplier_bps` | `number` | 倍数（基点） | `12000` |
| `odds_home_bps` | `number?` | 主队赔率（bps，可选） | `10500` |
| `odds_away_bps` | `number?` | 客队赔率（bps，可选） | `9500` |
| `payout_expected` | `number` | 预期赔付（原始单位） | `680000000` |
| `status` | `number` | 状态：`1下注/2赢/3输/4取消/5退款/6提前平仓` | `2` |
| `is_claimed` | `boolean` | 是否已领取 | `false` |
| `pnl` | `number` | 盈亏（原始单位） | `80000000` |
| `fee_paid` | `number` | 手续费（原始单位） | `2000000` |
| `close_price` | `number?` | 平仓价（可选） | `1234500` |
| `close_pnl` | `number?` | 平仓盈亏（可选） | `-12000000` |
| `timestamp` | `string` | 记录时间（ISO） | `2024-10-10T12:00:00Z` |
| `created_at` | `string` | 创建时间（ISO） | `2024-10-10T10:00:00Z` |
| `updated_at` | `string` | 更新时间（ISO） | `2024-10-10T11:00:00Z` |
| `closed_at` | `string?` | 关闭时间（ISO，可选） | `2024-10-10T11:30:00Z` |
| `transaction_signature` | `string?` | 交易签名（可选） | `5yZ...abc` |
| `confirmation_status` | `string` | 确认状态 | `confirmed` |
| `market` | `object?` | 市场信息（可选） | `{ fixture_id: '123', home_team: 'A', away_team: 'B', status: 1 }` |

> 状态映射：
>
> - 1：已下注
> - 2：已结算（赢）
> - 3：已结算（输）
> - 4：已取消
> - 5：已退款
> - 6：提前平仓

### 响应示例

#### 成功示例：查询持仓（前端代理层）

```json
{
  "ok": true,
  "positions": [
    {
      "id": 1001,
      "wallet_address": "AyWoecj5WdNCVG...",
      "market_address": "MarketXYZ123",
      "position_type": "OPEN",
      "selected_team": 1,
      "amount": 500000000,
      "multiplier_bps": 12000,
      "payout_expected": 680000000,
      "status": 1,
      "is_claimed": false,
      "pnl": 0,
      "fee_paid": 2000000,
      "timestamp": "2024-10-10T12:00:00Z",
      "created_at": "2024-10-10T10:00:00Z",
      "updated_at": "2024-10-10T11:00:00Z",
      "confirmation_status": "confirmed",
      "market": { "fixture_id": "123", "home_team": "A", "away_team": "B", "status": 1 }
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "total_pages": 1 }
}
```

#### 错误示例：查询持仓（缺少参数）

```json
{
  "ok": false,
  "error": "wallet_address is required"
}
```

#### 成功示例：用户统计（前端代理层）

```json
{
  "ok": true,
  "stats": {
    "total_positions": 42,
    "open_positions": 3,
    "closed_positions": 39,
    "won_positions": 21,
    "lost_positions": 18,
    "total_volume": 1200000000,
    "total_pnl": -34000000,
    "total_fees_paid": 5600000,
    "win_rate": 0.538
  }
}
```

#### 错误示例：用户统计（后端异常）

```json
{
  "ok": false,
  "error": "Backend error"
}
```

---

## 接口调用示例

> 测试环境默认：前端 `http://localhost:3000`，后端 `http://localhost:8080/api/v1`。

### 查询用户持仓（前端代理）

```bash
curl -s "http://localhost:3000/api/positions?wallet_address=AyWoecj5WdNCVG4HaCyjK9NS1aiaR7FokpkiTPNDgPoa&limit=100"
```

### 创建持仓（前端代理）

```bash
curl -s -X POST "http://localhost:3000/api/positions" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "AyWoecj5WdNCVG4HaCyjK9NS1aiaR7FokpkiTPNDgPoa",
    "market_address": "MarketXYZ123",
    "selected_team": 1,
    "amount": 500000000,
    "multiplier_bps": 12000,
    "odds_home_bps": 10500,
    "odds_away_bps": 9500
  }'
```

### 关闭持仓（前端代理，PATCH 动作）

```bash
curl -s -X PATCH "http://localhost:3000/api/positions" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "close",
    "position_id": 1001,
    "wallet_address": "AyWoecj5WdNCVG4HaCyjK9NS1aiaR7FokpkiTPNDgPoa",
    "close_price": 1234500
  }'
```

### 关闭持仓（前端代理，专用路由）

```bash
curl -s -X POST "http://localhost:3000/api/positions/close" \
  -H "Content-Type: application/json" \
  -d '{
    "position_id": 1001,
    "wallet_address": "AyWoecj5WdNCVG4HaCyjK9NS1aiaR7FokpkiTPNDgPoa",
    "close_price": 1234500
  }'
```

### 用户统计（前端代理）

```bash
curl -s "http://localhost:3000/api/users/stats?wallet_address=AyWoecj5WdNCVG4HaCyjK9NS1aiaR7FokpkiTPNDgPoa"
```

### 查询用户持仓（后端服务）

```bash
curl -s "http://localhost:8080/api/v1/compat/users/AyWoecj5WdNCVG4HaCyjK9NS1aiaR7FokpkiTPNDgPoa/positions?limit=100"
```

### 创建持仓（后端服务）

```bash
curl -s -X POST "http://localhost:8080/api/v1/compat/positions" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "AyWoecj5WdNCVG4HaCyjK9NS1aiaR7FokpkiTPNDgPoa",
    "market_address": "MarketXYZ123",
    "selected_team": 1,
    "amount": 500000000,
    "multiplier_bps": 12000
  }'
```

### 关闭持仓（后端服务）

```bash
curl -s -X POST "http://localhost:8080/api/v1/compat/positions/close" \
  -H "Content-Type: application/json" \
  -d '{
    "position_id": 1001,
    "wallet_address": "AyWoecj5WdNCVG4HaCyjK9NS1aiaR7FokpkiTPNDgPoa",
    "close_price": 1234500
  }'
```

### 用户统计（后端服务）

```bash
curl -s "http://localhost:8080/api/v1/users/AyWoecj5WdNCVG4HaCyjK9NS1aiaR7FokpkiTPNDgPoa/stats"
```

---

## 错误代码表

> 说明：以下为常见错误代码与含义，前端代理层在部分情况下对后端错误做了“空态映射”，以避免页面报错（如后端 404 → 前端 200 空数据）。

| 错误代码 | 层级 | 含义 | 触发条件 | 解决建议 |
|---|---|---|---|---|
| `400` + `wallet_address is required` | 前端/后端 | 缺少必需参数 | 查询接口未传 `wallet_address` | 补齐参数，确保地址合法 |
| `400` + `Missing required fields` | 前端 | 创建持仓缺少字段 | POST `/api/positions` 体不完整 | 按数据结构补齐所有必填项 |
| `400` + `INVALID_NUMERIC` | 前端 | 非数字字段无法规范化 | `amount` / `multiplier_bps` 非数字 | 传入合法数字或做类型转换 |
| `400` + `BAD_JSON` | 前端 | 请求体不是合法 JSON | POST 体为空或非 JSON | 传入合法 JSON 并设置 `Content-Type: application/json` |
| `400` + `position_id required` | 前端 | 缺少持仓ID | 关闭持仓未传 `position_id` | 在 PATCH/POST 体中提供 `position_id` |
| `400` + `Unsupported action` | 前端 | 不支持的动作 | PATCH `/api/positions` 非 `close` 动作 | 使用 `action=close` 或改用专用路由 |
| `404` | 后端 | 资源不存在 | 用户或持仓记录不存在 | 前端会映射为空态返回 200；后端调用方需自行处理 |
| `500` + `Internal error` | 前端 | 代理层内部错误 | 解析异常或网络错误 | 重试、开启调试（`NEXT_PUBLIC_API_DEBUG=true`）查看日志 |
| `5xx` + `Backend error` | 后端 | 服务端异常 | 数据库/服务不可用等 | 检查后端服务健康（`/health`）、查看后端日志 |

> 配置建议：
>
> - 在前端 `.env` 设置 `NEXT_PUBLIC_API_BASE_URL` 指向后端服务地址（含 `/api/v1`）。
> - 调试时设置 `NEXT_PUBLIC_API_DEBUG=true`，便于查看请求/响应日志。 
> - 生产环境确保 CORS 允许前端域名（`CORS_ORIGINS`）。

---

如需扩展文档（例如增加“账户余额/交易历史”等接口），可在本文件新增章节，并保持表格与示例规范一致。