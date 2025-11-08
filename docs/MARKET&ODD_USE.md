# MARKET & ODDS 使用说明

本说明基于 `docs/BACKEND_MARKETSVC&ODDSVC.md` 的接口规范，介绍如何在本后端中使用市场与赔率服务，涵盖请求示例、响应结构、缓存行为、管理端覆盖与部署提示。

## 快速开始

- 服务启动：设置 `DATABASE_URL`、`REDIS_URL`、`JWT_SECRET` 环境变量后运行后端。
- 就绪探针：`GET /readyz` 返回关键依赖是否可用。
- 存活探针：`GET /healthz` 恒定 200。

## 接口速览

- `GET /markets`：
  - 无数据库：返回简化数组 `[ { id, name, active } ]`（开发/测试模式）。
  - 有数据库：返回分页与筛选结构 `{ page, pageSize, total, items: [ { id, league, title, status, start_time, odds } ] }`，`odds.moneyline` 优先从缓存聚合，未命中回退 DB 计算。

- `GET /markets/{id}`：返回市场详情；当数据库可用时包含 `odds` 聚合（缓存优先）。

- `GET /odds/{market_id}`：返回当前赔率
  - 旧字段：`odds_a`、`odds_b`（兼容现有前端/测试，单位 bps）
  - 新结构：`moneyline`、`spread`、`total`（若存在），`source` 标识 `cache|db|override`。

- 管理端（需 Bearer JWT 且角色为 `admin`）：
  - `POST /admin/markets`：创建市场（NBA/EPL）。请求体：
    ```json
    { "league":"NBA", "home_team":"Lakers", "away_team":"Warriors", "start_time":1730908800000 }
    ```
    响应：`201 { "id": <market_id> }`

  - `PUT /admin/markets/{id}`：更新 `status|description`。响应：`204`。

  - `POST /admin/odds/override`：写入覆盖并写穿缓存。请求体：
    ```json
    {
      "market_id": 1001,
      "payload": {
        "moneyline": { "home": 1.82, "away": 2.15 },
        "spread":    { "line": -3.0, "home": 1.92, "away": 1.88 },
        "total":     { "line": 219.5, "over": 1.90, "under": 1.90 }
      },
      "reason": "Manual adjustment"
    }
    ```
    响应：`201 { "override_id": <id>, "applied": true }`

## 缓存与一致性

- 赔率缓存：
  - 简单键：`odds:{marketId}` 保存 `odds_a/odds_b`，TTL=60s。
  - 复合键：`oddsq:{marketId}` 保存 `moneyline/spread/total` JSON，TTL=60s。
  - 读路径：缓存优先；未命中回退 DB 并写回缓存。
  - 写路径：管理员覆盖后写审计并写穿缓存复合键。

- 活跃市场快照：`GET /markets/active` 支持缓存命中与 DB 构建，键 `markets:active`，TTL=30s。

## 安全与审计

- JWT 与角色：
  - `auth/nonce` + `auth/verify-sig` 完成登录；默认用户角色 `user`。
  - 管理操作需 `admin` 角色，测试可通过手动将用户角色设为 `admin`。

- 覆盖审计：使用 `admin_actions` 表记录 `ODDS_OVERRIDE`，包含操作者、资源与 JSON payload。

## 部署提示

- 环境变量：`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`、`PORT`、`RUST_LOG`。
- 运行指标：缓存命中 p95 < 100ms；DB 回退 p95 < 300ms；热门命中率 ≥ 92%。
- 观测：`tracing` 日志、路由延迟日志、缓存操作告警。

## 示例

```bash
# 获取市场列表（数据库模式）
curl 'http://localhost:8080/markets?league=NBA&page=1&pageSize=20&sortBy=created_at&order=asc'

# 获取赔率（复合结构）
curl 'http://localhost:8080/odds/1001'

# 管理端覆盖（需 Bearer Token）
curl -H 'Authorization: Bearer <ADMIN_TOKEN>' \
     -H 'Content-Type: application/json' \
     -d '{"market_id":1001,"payload":{"moneyline":{"home":1.82,"away":2.15}}}' \
     'http://localhost:8080/admin/odds/override'
```