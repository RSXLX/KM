# 前后端数据结构映射与兼容策略

## 范围
- 对齐对象：市场（Market）、订单/持仓（Order/Position）
- 前端参考：`fronted/types/index.ts`（UI层）、`fronted/types/database.ts`（DB/API层）
- 后端参考：PostgreSQL表（`markets`/`orders`/`users`）、Rust模型（`src/models/*`）与响应DTO

## 映射表（核心字段）

### Market（前端 DB/API → 后端）
| 前端字段 | 类型 | 后端来源/策略 |
|---|---|---|
| id | number | `markets.id` |
| market_id_seed | Buffer | 暂不使用（保留字段），可映射为 NULL 或字节列 |
| market_address | string | 新增列 `markets.market_address`（可选） |
| home_code/away_code | number | 新增列 `markets.home_code/away_code` |
| home_name/away_name | string | 新增列 `markets.home_name/away_name` |
| start_time | Date | `markets.start_time` |
| close_time | Date | 新增列 `markets.close_time`（由 `end_time`复制/映射） |
| state | number | 新增列 `markets.state`（枚举 int：Open=1,Closed=2,Resolved=3,Canceled=4） |
| result | number | 新增列 `markets.result`（0=None,1=Home,2=Away） |
| odds_home_bps/odds_away_bps | number | 新增列（bps） |
| max_exposure/current_exposure | numeric | 新增列（NUMERIC） |
| total_volume/total_bets | numeric/int | 新增列，统计来源 `orders` 聚合 |
| resolved_at | Date | 新增列 |

UI层 `types/index.ts::Market` 通过映射器转换：
- `title/description/imageUrl/category` 来自市场内容源或默认占位；此为UI模型，不要求与DB一一对应。

### Position（前端 DB/API → 后端）
| 前端字段 | 类型 | 后端来源/策略 |
|---|---|---|
| id | number | `orders.id` |
| user_id | number | `orders.user_id` |
| market_id | number | `orders.market_id` |
| wallet_address | string | `users.address` |
| market_address | string | `markets.market_address` |
| bet_address | string? | 保留为 NULL（当前不支持） |
| nonce | number | 映射 `orders.id` 或独立序列 |
| position_type | 'OPEN'|'CLOSE' | 固定 'OPEN'（订单等价开仓），平仓暂不支持 |
| selected_team | number | `orders.option` → 0:Home(1)/1:Away(2) |
| amount | number(lamports) | 映射：`orders.amount * 1e9`（若币别为SOL）；或原样 NUMERIC |
| multiplier_bps | number | `orders.odds * 10000`（四舍五入） |
| odds_home_bps/odds_away_bps | number? | 保留为 NULL（除非市场表维护） |
| payout_expected | number? | 保留为 NULL（待推导） |
| status | PositionStatus | `orders.status` 映射：placed→1/cancelled→4/settled→2 |
| is_claimed | boolean | 默认 false |
| pnl/fee_paid | number | 默认 0 |
| close_price/close_pnl | number? | NULL |
| timestamp/created_at/updated_at | Date | `orders.created_at/updated_at` |
| closed_at | Date? | NULL |
| transaction_signature/block_slot/confirmation_status | | 保留为 NULL/'pending' |

## 兼容策略
- 保留后端现有API路径；增加兼容路径 `/api/v1/compat/*` 输出前端 DB/API 结构。
- 不移除原列，新增对齐列并提供视图/映射，确保历史数据保留与可用。
- 日期时间统一使用 ISO8601（UTC），枚举数值按前端约定（见上表）。

## 变更与回滚
- 迁移脚本：新增列与视图（不破坏原数据）。
- 回滚：删除视图与新增列（或保留列冻结），不影响原表核心字段。

## 测试范围
- 单元：映射函数输出准确数据类型与枚举值。
- 集成：兼容接口返回与前端 `types/database.ts` 对齐；历史订单映射为 Position 视图。