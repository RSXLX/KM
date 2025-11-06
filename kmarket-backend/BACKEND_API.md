# KMarket Backend API (v0)

## 基础
- Base URL: `http://localhost:8080`
- 认证：暂不启用（后续 JWT）
- 响应格式：`application/json`

## 监控
- `GET /healthz`
  - 200 `{ "status": "ok" }`
- `GET /readyz`
  - 200 `{ "ready": true }`（当 DB/Redis 已配置）
  - 503 `{ "ready": false, "requires": { "database_url": bool, "redis_url": bool } }`

## 市场（Market）
- `GET /markets`
  - 200 `[ { id, name, active } ]`
  - 说明：若未连接数据库，返回内存示例数据
- `GET /markets/{id}`
  - 200 `{ id, name, active }`
  - 404 `{ code: 404, error: "not found: market {id} not found" }`

## 错误格式
- 统一错误：
```json
{ "code": <http_status>, "error": "<message>" }
```

## 后续计划（文档占位）
- `POST /auth/verify-sig`：钱包签名校验与 JWT 发放
- `GET /markets/{id}/odds`：当前赔率（Redis 缓存）
- `POST /bets`：链上下注与订单入库
- WebSocket `/ws/odds`：实时赔率推送