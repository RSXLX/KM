# levr-bet 合约 lib.rs 逻辑概览

本文档基于 `anchor/levr-bet/programs/levr_bet/src/lib.rs` 的源码内容整理，记录核心指令、账户模型、费用与风险控制、事件与错误码等关键逻辑，便于在删除合约目录后保留设计与实现参考。

## Program 与常量
- Program 名称：`levr_bet`
- Program ID：源码中为占位，实际部署由 CI(`anchor keys sync`)更新
- 常量：`SCALE_BPS = 10000`，用于赔率与倍数的统一缩放

## 指令总览
- `initialize_config(params)`：初始化平台配置
- `open_market(args)`：开启一个新市场（基于 `market_id_seed` 派生 PDA）
- `place_bet(args)`：SOL 路径下注，资金进入市场 `escrow` PDA
- `resolve_market(result)`：管理员裁决比赛结果
- `close_bet(args)`：用户提前平仓，按当前市场价格结算（扣平仓费）
- `claim_payout()`：赛果公布后兑付（赢家领取，扣平台费）

## 账户与 PDA（摘要）
- `ConfigAccount`：平台配置（authority、费率、下注范围、最大赔率与倍数、资金地址、bump）
- `MarketAccount`：市场信息（home/away、时间、状态、结果、赔率、最大敞口与当前敞口、bump、escrow_bump）
- `BetAccount`：用户下注信息（用户、市场、nonce、队伍、下注金额、预期兑付、时间戳、状态、是否已兑付、盈亏、可选的平仓价与时间戳、bump）
- `Escrow`：`SystemAccount` 类型，PDA 路径：`["escrow", market.key(), "SOL"]`
- 主要 Seeds：
  - `config`: `["config"]`
  - `market`: `["market", market_id_seed]`
  - `escrow`: `["escrow", market.key(), "SOL"]`
  - `bet`: `["bet", user.key(), market.key(), nonce]`

## 费用与风控
- 平台费：`fee_bps`，在 `claim_payout`（赛后兑付）和 `close_bet`（提前平仓）计算并从兑付中扣除
- 风险敞口：下单前计算 `new_exposure = market.exposure + amount`，需 `<= market.max_exposure`
- 赔率与倍数校验：
  - `odds_bps` 需在 `[SCALE_BPS, cfg.max_odds_bps]`
  - `multiplier_bps` 需在 `[SCALE_BPS, cfg.max_multiplier_bps]`
- 下注范围：`amount` 在 `[min_bet, max_bet]`

## 关键公式
- 预期兑付（含本金）：
  - `payout_expected = amount * odds_bps * multiplier_bps / (SCALE_BPS^2)`
- 提前平仓：
  - `current_value = amount * current_odds_bps * multiplier_bps / (SCALE_BPS^2)`
  - `close_fee = current_value * fee_bps / SCALE_BPS`
  - `net_payout = current_value - close_fee`
  - `pnl = net_payout - amount`
- 赛后兑付（赢家）：
  - `payout = bet.payout_expected`
  - `fee = payout * fee_bps / SCALE_BPS`
  - `pnl = payout - amount`
- 赛后兑付（输家）：
  - `payout = 0`，`fee = 0`，`pnl = -amount`

## 指令细节
### 1) initialize_config
- 设置 `authority` 与各项参数（mint、fee、house_cut、min/max bet、max_odds、max_multiplier、treasury_sol）
- 记录 `config.bump`

### 2) open_market
- 仅 `authority` 可调用
- 初始化 `MarketAccount`：`state = Open`，`result = 0`，记录 `odds_home_bps / odds_away_bps`、`max_exposure`、`exposure = 0`
- 记录 `market.bump` 与可选 `escrow_bump`

### 3) place_bet（SOL）
- 前置校验：市场开放、金额范围、倍数范围、队伍合法、赔率合法、敞口不超限
- CPI 转账：`user -> escrow`（SystemProgram）
- 初始化 `BetAccount`：记录用户、市场、nonce、队伍、赔率、倍数、金额、`payout_expected`、`timestamp`、`status = Placed`、`claimed = false`、`pnl = 0`
- 更新市场敞口：`market.exposure += amount`
- 事件：`EventBetPlaced`

### 4) resolve_market
- 仅 `authority` 可调用
- 设置 `market.result = {1|2}`，`state = Resolved`
- 事件：`EventMarketResolved`

### 5) close_bet（提前平仓）
- 前置校验：市场需 `Open`、下注状态为 `Placed`、未 `claimed`、用户与市场匹配
- 使用传入的 `close_price_bps`（若为空，读取当前赔率）计算 `current_value`
- 计算平仓费与净兑付；从 `escrow` 分别转账至 `treasury` 与 `user`（使用 PDA signer）
- 更新 `BetAccount`：`status = ClosedEarly`、`claimed = true`、记录 `pnl`、`close_price`、`close_timestamp`
- 更新市场敞口：`exposure -= bet.amount`
- 事件：`EventBetClosed`

### 6) claim_payout（赛后兑付）
- 前置校验：市场需 `Resolved`、下注未 `claimed`、用户与市场匹配
- 若赢：按 `payout_expected` 计算平台费，从 `escrow` 转账至 `treasury` 与 `user`
- 若输：不兑付（`payout=0`）
- 更新 `BetAccount`：标记 `claimed`、`status = SettledWin | SettledLose`、记录 `pnl`
- 事件：`EventBetClaimed`

## 事件
- `EventBetPlaced`：下单成功（用户、市场、队伍、金额、赔率、倍数）
- `EventMarketResolved`：市场裁决（市场、结果）
- `EventBetClosed`：提前平仓（用户、市场、下注、平仓价、兑付、盈亏）
- `EventBetClaimed`：赛后兑付（用户、市场、兑付、盈亏）

## 错误码（示例）
- `Unauthorized`、`MarketClosed`、`MarketNotResolved`、`InvalidOdds`、`InvalidMultiplier`、`InvalidTeam`、`InvalidResult`、`AmountOutOfRange`、`MaxExposureExceeded`、`AlreadyClaimed`、`BetNotFound`、`Overflow`

## 状态机
- 市场：`Open -> Resolved`（或 `Closed/Canceled`）
- 下注：`Placed -> ClosedEarly` 或 `Placed -> SettledWin/SettledLose`（也可 `Canceled/Refunded`）

## 设计备注
- `bet.pnl = 0` 在下单时初始化，后续在平仓或赛后兑付时更新为实际盈亏。
- 资金流全部经过 `escrow` PDA，使用 `SystemProgram::transfer` 并以 PDA signer 进行授权。
- 提前平仓支持传入市场价基点（`close_price_bps`），缺省时使用当前赔率。
- 风控围绕最大敞口与赔率/倍数上限。

---
以上为 `lib.rs` 的核心逻辑记录，便于后续参考与复用。