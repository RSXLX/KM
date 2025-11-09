# KMarket Backend API 文档

## 概述
- 基础URL：`http://localhost:8080`
- 版本前缀：`/api/v1`
- 认证：当前无需认证；后续可在请求头添加 `Authorization: Bearer <token>`
- 响应格式：统一使用

```json
{
  "success": true,
  "data": {},
  "error": { "code": "", "message": "" },
  "timestamp": 1700000000
}
```

## 健康检查
- 接口：`GET /health`
- 说明：服务健康与数据库心跳
- 请求头：无
- 成功响应示例：
```json
{
  "success": true,
  "data": { "database": "ok", "version": "0.1.0" },
  "error": null,
  "timestamp": 1700000000
}
```

## 市场相关
### 获取市场列表
- 接口：`GET /api/v1/markets`
- 参数：
  - `page` (number, 可选，示例：1)
  - `page_size` (number, 可选，最大100，示例：20)
- 示例：
```
curl -s http://localhost:8080/api/v1/markets
```
- 成功响应（示例，截断）：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "market_id": 1001,
      "title": "Demo Market",
      "option_a": "Option A",
      "option_b": "Option B",
      "status": "Active"
    }
  ],
  "error": null,
  "timestamp": 1700000000
}
```

### 获取市场详情
- 接口：`GET /api/v1/markets/{market_id}`
- 路径参数：`market_id` (number，示例：1001)
- 示例：
```
curl -s http://localhost:8080/api/v1/markets/1001
```

### 获取市场统计
- 接口：`GET /api/v1/markets/{id}/stats`
- 路径参数：`id` (number，内部表ID，示例：1)
- 示例：
```
curl -s http://localhost:8080/api/v1/markets/1/stats
```
- 成功响应示例：
```json
{
  "success": true,
  "data": {
    "bets_a": 1,
    "bets_b": 0,
    "amount_a": "10.000000000000000000",
    "amount_b": "0",
    "total_orders": 1
  },
  "error": null,
  "timestamp": 1700000000
}
```

## 订单相关
### 创建订单（事务+审计）
- 接口：`POST /api/v1/orders`
- 请求头：`Content-Type: application/json`
- 请求体：
```json
{
  "order_id": 700101,
  "user_id": 1,
  "market_id": 1,
  "amount": 3.5,
  "odds": 1.8,
  "option": 0
}
```
- 示例：
```
curl -s -X POST http://localhost:8080/api/v1/orders \
  -H 'Content-Type: application/json' \
  -d '{"order_id":700101,"user_id":1,"market_id":1,"amount":3.5,"odds":1.8,"option":0}'
```
- 成功响应示例（截断）：
```json
{
  "success": true,
  "data": {
    "id": 2,
    "order_id": 700101,
    "user_id": 1,
    "market_id": 1,
    "amount": "3.500000000000000000",
    "odds": "1.80000000",
    "option": 0,
    "status": "Placed"
  },
  "error": null,
  "timestamp": 1700000000
}
```
- 错误响应（示例）：
  - 重复订单号：`400 DuplicateKey`
  - 非法参数：`400 InvalidArgument`

### 获取用户订单
- 接口：`GET /api/v1/users/{address}/orders`
- 路径参数：`address` (string，示例：`0x000...001`)
- 示例：
```
curl -s http://localhost:8080/api/v1/users/0x0000000000000000000000000000000000000001/orders
```

### 获取用户统计
- 接口：`GET /api/v1/users/{address}/stats`
- 示例：
```
curl -s http://localhost:8080/api/v1/users/0x0000000000000000000000000000000000000001/stats
```
- 成功响应示例：
```json
{
  "success": true,
  "data": {
    "placed": 2,
    "cancelled": 0,
    "settled": 0,
    "amount_placed": "13.500000000000000000",
    "amount_settled": "0"
  },
  "error": null,
  "timestamp": 1700000000
}
```

## 权限要求
- 目前所有接口开放，无角色限制；后续可为敏感接口（如管理操作）增加基于JWT的角色校验。

## 错误码
- `400 InvalidArgument`：参数无效或缺失
- `400 DuplicateKey`：唯一约束冲突
- `404 NotFound`：资源不存在
- `500 InternalServerError`：服务内部错误

## 备注
- `market_id` 与内部 `id` 含义不同：
  - `GET /api/v1/markets/{market_id}` 使用业务ID（例如1001）
  - `GET /api/v1/markets/{id}/stats` 使用内部表ID（例如1）