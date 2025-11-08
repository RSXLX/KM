# Bets & Settlement API 文档（v1）

## 概述
- 本文定义下注与结算相关接口，数据结构与错误约定，与 `docs/BACKEND_REQUIREMENTS_BETTING_SETTLE.md` 一致。

## 认证
- `Authorization: Bearer <JWT>`（公共接口建议启用）。

## 错误格式
```json
{ "code": <http_status>, "error": "<message>" }
```

## 接口
- `POST /api/v1/bets`
  - 入参
```json
{ "marketId": 123456, "option": 1, "amount": "1000000", "odds": 185, "maxSlippage": "0.02" }
```
  - 出参
```json
{ "orderId": 987654321, "status": "sent", "txHash": "0x...", "settled": false, "claimed": false }
```

- `GET /api/v1/bets/{orderId}`
  - 出参（示例）
```json
{ "orderId": 987654321, "userAddress": "0x...", "marketId": 123456, "amount": "1000000", "odds": 185, "option": 1, "potentialPayout": "1850000", "settled": true, "claimed": false, "txHash": "0x..." }
```

- `GET /api/v1/bets?userAddress={0x..}&marketId={id}&status=pending|confirmed&page=1&pageSize=20`
  - 出参
```json
{ "page": 1, "pageSize": 20, "total": 2, "items": [ /* OrderResp[] */ ] }
```

- `POST /api/v1/bets/{orderId}/claim`
  - 出参
```json
{ "orderId": 987654321, "claimed": true, "claimAmount": "1850000", "claimTxHash": null }
```

- `POST /admin/markets/{id}/settle`（管理员）
```json
{ "winning_option": 1 }
```
  - 出参
```json
{ "marketId": 123456, "winningOption": 1, "status": "settled" }
```

## 规则说明
- 结算：胜方订单 `potential_payout = amount * odds / 100`（整数赔率）。败方订单 `potential_payout = 0`。
- 领取：仅当 `settled=true && potential_payout>0 && claimed=false` 时允许。成功后写 `order_claims` 并将 `orders.claimed=true`。

## 边界与错误
- `400` 参数非法、选项不存在、市场不活跃。
- `404` 订单或市场不存在。
- `409` 重复领取。
- `422` 余额或 allowance 校验失败（链上集成时）。
- `503` 依赖未配置（DB/Redis）。

## 示例 cURL
```bash
curl -X POST http://localhost:8080/api/v1/bets -H "Content-Type: application/json" -d '{"marketId":123,"option":1,"amount":"1000","odds":185}'
```