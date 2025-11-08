# 提前平仓（Close Position）API 合同与单位约定

本文档定义“提前平仓”接口合同、单位约定、计算规则、幂等策略与边界场景，适用于手动平仓与链上事件驱动平仓（BetClosed）。

## 背景与目标
- 用户在市场未结束前主动关闭持仓，以当前赔率计算盈亏。
- 生成一条 `CLOSE` 记录并将原始 `OPEN` 持仓标记为提前平仓（`status=6`）。
- 全链路单位统一：金额用 `lamports`，赔率用 `bps`（万分位）。

## 术语与单位
- 金额：`lamports`（Solana 原子单位）。展示时转换为 `SOL`（`lamports / 1e9`）。
- 赔率：`bps`（万分位）。例如 1.85 → 8500 bps。
- 倍数：`multiplier_bps`（万分位），展示时 `multiplier = multiplier_bps / 10000`。

## 接口：POST /api/positions/close
- 功能：创建 `CLOSE` 记录并更新原始 `OPEN` 为 `status=6`。
- 幂等：基于 `transaction_signature`。重复签名返回已存在的 `CLOSE` 记录。

### Request Body
```json
{
  "position_id": 123,                    // 原始开仓ID，必填
  "wallet_address": "<base58>",        // 钱包地址，必填（归属校验）
  "transaction_signature": "<string>", // 幂等键，必填
  "close_price_bps": 8500,              // 平仓赔率，bps，可选；未传则使用市场当前赔率
  "close_fee_lamports": 0               // 平仓费用，lamports，可选
}
```

### 校验规则
- 归属校验：`position_id` 对应的 `OPEN` 属于 `wallet_address`。
- 状态校验：仅当 `OPEN.status = 1` 可平仓；市场状态不开放时仍允许以回退赔率结算（策略可配置）。
- 幂等校验：若存在相同 `transaction_signature` 的 `CLOSE`，直接返回已存在记录。

### PnL 计算
- `open_price_bps = (selected_team == 1) ? (odds_home_bps) : (odds_away_bps)`
- `close_price_bps = 请求.close_price_bps || 市场当前对应队伍赔率`
- `delta_bps = close_price_bps - open_price_bps`
- `multiplier = multiplier_bps / 10000`
- `gross_pnl = round(amount * (delta_bps / 10000) * multiplier)`
- `net_pnl = gross_pnl - close_fee_lamports`

### Response Body
```json
{
  "ok": true,
  "close_id": 456,                     // 新建的CLOSE记录ID
  "original_position_id": 123,         // 原始OPEN记录ID
  "pnl": 98765,                        // 结算后的净PnL，lamports
  "message": "Position closed"        // 信息
}
```

### 错误码（示例）
- `400 MISSING_FIELDS`：缺少必填参数。
- `403 WALLET_MISMATCH`：钱包不匹配该持仓。
- `404 OPEN_NOT_FOUND`：开仓不存在或不可平仓。
- `404 MARKET_NOT_FOUND`：市场不存在。
- `400 MISSING_ODDS`：无法获取开/平仓赔率。
- `500 DB_ERROR`：数据库操作失败。

## 数据落库约定
- 创建 `CLOSE` 记录：`position_type='CLOSE'`，保存 `close_price_bps`、`pnl`、`fee_paid`、`ref_position_id`（指向原始OPEN）。
- 更新原始 `OPEN`：`status=6`（提前平仓），写入 `closed_at`、`updated_at`。

## 事件驱动平仓（BetClosed）
- 事件监听器将 `close_price_bps` 与 `transaction_signature` 传入 `POST /api/positions/close`（幂等）。
- 若事件携带 `pnl`，后端可做差异校验（以链上为准或记录差异）。

## 前端约定
- 输入/展示层可用小数赔率与SOL，但提交后端必须转换为 `bps` 与 `lamports`。
- 手动平仓建议直接使用市场价；若支持自定义平仓赔率，输入为 `bps`，例如 1.92 → 9200。
- 发送 `transaction_signature` 作为幂等键（可用合成签名：`manual-close-<positionId>-<timestamp>`）。

## 弱网与同步策略（小程序）
- 幂等提交：重复点击不重复落库。
- 离线队列与重试：超时 5-10s，退避重试最多 3 次。
- 快照与版本：响应包含 `updated_at/closed_at`，前端比对丢弃旧数据。
- 断线重连：恢复后重新拉取持仓列表并重试未完成平仓。

## 边界场景
- 市场临近收盘：允许平仓，但以最新可用赔率计价并记录时间窗。
- 消息乱序：以版本与时间戳抑制旧状态覆盖。
- 重复交易：幂等保障返回同一 `close_id`。

## 变更日志
- v1.0：统一单位为 `bps/lamports`，`OPEN` 平仓状态固定为 `status=6`；接口幂等基于 `transaction_signature`。