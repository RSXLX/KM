## 改造目标与范围
- 前端：统一下注入口、强化表单校验、错误提示与幂等、防重；API 代理统一封装；EVM 占位。
- 中间层（Next.js /api/*）：统一错误码映射、支持幂等键透传、钱包签名校验代理优化（超时/取消）。
- 后端（Actix + SQLx）：签名/确认状态落库、PnL/结算完善、审计扩展、接口幂等与一致性、传输与安全加固、为真实支付清算预留接口。

## 一、统一下注入口（接入 /api/positions）
- 复用参数构造：将 `components/market/BetModal.tsx` 的下注行为重定向至 `POST /api/positions`，复用 `SportsBettingClient` 的构造逻辑（`wallet_address`、`fixture_id/market_address`、`selected_team`、`amount`、`multiplier_bps`、`odds_*_bps`、`transaction_signature`）。
- 前端更改：在 `fronted/components/market/BetModal.tsx` 按 `fronted/components/sports/SportsBettingClient.tsx` 的 `onConfirm` 约定组包并调用 `lib/apiClient.post`；将成功回执与 `PaymentSuccessModal` 对齐。
- API 代理契约：使用 `fronted/app/api/positions/route.ts:10`（POST 创建）代理到后端 `/compat/positions` 并保持归一化字段。

## 二、强化前端表单校验
- 金额与精度：限制最小/最大金额、固定小数位（例如 2 位）、步进；在输入时和提交前双重校验，并对越界给出提示。
- 钱包健康校验：强制钱包已连接，读取余额/授权额度并与下注金额比较；余额不足时阻止提交并给出引导。
- 风险提示与复核弹窗：提交前展示复核信息（队伍、赔率、潜在收益、手续费、签名哈希）并二次确认。
- 统一错误呈现：对不同错误码显示用户友好的文案与行动建议（重试/联系支持）。

## 三、幂等性与防重
- 前端
  - 生成 `idempotency_key`：用稳定材料（`wallet_address + market + selected_team + amount + odds + timestamp`）或使用 UUID；随请求体或请求头透传。
  - UI 防重：提交中禁用按钮、`apiClient` 的 `dedupKey` 启用去重。
- 后端
  - 路由支持：`kmarket-backend/src/routes/compat.rs:190` 创建持仓支持 `idempotency_key`；若存在相同键的订单则返回已存在记录（HTTP 200），避免重复插入。
  - 唯一约束：为 `orders(idempotency_key)` 增加唯一索引；当存在 `transaction_signature` 时仍以签名哈希稳定生成 `order_id`（保留现有逻辑），但以 `idempotency_key` 作为最终幂等保护。

## 四、支付/签名状态落库与异步确认
- 数据模型
  - 新增表 `wallet_ledger`（或扩展 `orders`）：记录 `order_id`、`wallet_address`、`transaction_signature`、`block_slot`、`direction`、`fee_lamports`、`confirmation_status`、`created_at/updated_at`；`transaction_signature` 唯一约束，强绑定持仓。
  - 若扩展 `orders`：新增列 `transaction_signature`（唯一）、`block_slot`、`confirmation_status`（枚举：`pending|confirmed|finalized|failed`）。
- 写入与更新
  - 创建时：前端提交签名后，后端将签名与初始 `confirmation_status='pending'` 落库。
  - 异步确认：启动后台任务（Tokio 定时器）轮询 `pending` 记录，通过 Solana RPC 查询，更新 `block_slot` 与 `confirmation_status`（`confirmed/finalized`）；失败时标记为 `failed` 并写审计。
- 前端代理
  - `fronted/app/api/wallet-ledger/route.ts:8` 仍用于快速校验，但仅作预检查；真正持久化由后端完成。

## 五、统一错误码与提示
- 错误码字典（示例）
  - 通用：`BAD_JSON`、`INVALID_NUMERIC`、`INVALID_ARGS`、`INTERNAL_ERROR`
  - 市场/订单：`MARKET_NOT_FOUND`、`ORDER_CREATE_FAILED`、`POSITION_NOT_FOUND`、`CONCURRENCY_CONFLICT`
  - 支付/签名：`LEDGER_TIMEOUT`、`SIGNATURE_NOT_FOUND`、`SIGNATURE_MISMATCH`、`LEDGER_PERSIST_FAILED`
- 后端：在 `ApiResponse.error(code)` 中统一枚举；路由使用明确码。
- 前端：在 `lib/apiClient.ts` 上层建立映射，将后端 `code` 转为 UI 文案与恢复建议；在 `BetModal`/`SportsBettingClient` 弹窗统一呈现。

## 六、PnL 与结算逻辑完善
- 结算公式
  - 多头（下注胜队）：`pnl = amount * (odds_win - 1) - fee`
  - 空头或失败：`pnl = -amount - fee`（可按让分/方向调整）。
- 后端改造
  - 在 `kmarket-backend/src/repository/order_repo.rs:111` 的关闭事务中，改为按赔率与方向计算 `close_pnl`，并在同一事务中更新 `users.total_pnl`（已有字段）。
  - `positions_v`：如需暴露新的计算项，更新 `kmarket-backend/src/state.rs:110` 视图定义或相应 SQL，以返回 `payout`/`pnl` 字段。

## 七、日志与审计扩展
- 审计内容
  - 创建/关闭：记录 `actor`（钱包地址与 IP）、请求体摘要（哈希）、幂等键、签名哈希、结果状态。
- 落库位置
  - 复用 `create_with_audit` 与 `cancel_with_close_fields` 的事务，在审计表中增加额外字段；失败时保留失败审计。

## 八、API 代理层超时与取消统一
- 将 `/api/*` 路由中的 `fetch` 改为统一通过 `lib/apiClient.ts`：继承其 `AbortController` 超时、`dedupKey`、统一日志。
- 目标文件：`fronted/app/api/positions/route.ts:10`、`:64`、`:107`；`fronted/app/api/positions/close/route.ts:9`；`fronted/app/api/bets/route.ts` 全部迁移至 `apiClient` 封装。

## 九、EVM/多链兼容占位
- `lib/web3.ts`：提供标准接口占位（`getBalance(address)`, `sendMemo(signature)`, `getTxStatus(hash)`），暂不接入真实网关；通过环境变量选择链。
- 后端：抽象账本读取接口，Solana/EVM 通过策略模式实现；当前默认 Solana。

## 十、安全加固
- CSRF：在 Next.js `app/api/*` 引入 CSRF 校验（同源 Token + `SameSite=Lax` Cookie）；写操作必须携带 Token。
- Rate Limit：在 API 路由层做 IP/地址级速率限制（如固定窗口或令牌桶）。
- 重放保护：要求请求体包含 `timestamp`、`nonce` 并在后端校验窗口时间与唯一性；签名绑定请求参数。
- 传输安全：部署层强制 HTTPS 与 HSTS；前端在生产环境检测 `NEXT_PUBLIC_API_BASE_URL` 非 HTTPS 时阻止启动并警告。
- 鉴权：为管理/高风险路由引入 Bearer Token 校验；`apiClient` 透传 `Authorization`。

## 十一、真实支付清算支持（阶段性）
- 阶段 1：模拟清算（仅记账与签名确认），风控与限额上线。
- 阶段 2：接入第三方托管/支付网关（如合规服务商），统一代收与退款流程；后端引入网关订单号与状态机。
- 阶段 3：自有合约清算（Solana/EVM），对接链上合约与事件写库。

## 十二、数据迁移与索引
- 新增/修改表
  - `wallet_ledger`（或扩展 `orders`）含唯一索引 `transaction_signature` 与索引 `order_id`、`wallet_address`。
  - `orders` 增加 `idempotency_key` 唯一索引。
- 视图/物化视图
  - 更新或重建 `positions_v`（如需新增字段）；确保 `kmarket-backend/src/state.rs:110` 的存在检查与迁移兼容。

## 十三、测试与验证
- 前端
  - 单元测试：表单校验（边界/精度）、错误码映射、幂等键生成；使用 React Testing Library。
  - 集成测试：`/api/positions` 提交流程、失败重试与防重行为；模拟 RPC 超时。
- 后端
  - 单元测试：PnL 计算、审计写入、幂等插入的“已存在即返回”。
  - 集成测试：创建->确认->关闭完整事务，包含并发关闭冲突与重放保护。

## 十四、发布与回滚
- 分支与灰度：以特性分支提交，预发环境验证 RPC/数据库迁移；开启灰度后逐步扩大流量。
- 回滚策略：保留旧路由兼容（`/api/bets`），数据库迁移可逆（保留旧列/视图），审计表不删除，仅追加。

## 关键代码定位
- 前端
  - 创建代理：`fronted/app/api/positions/route.ts:10`（POST）、`:64`（GET）、`:107`（PATCH）
  - 钱包账本代理：`fronted/app/api/wallet-ledger/route.ts:8`（POST）、`:48`（GET）
  - 下注组件：`fronted/components/market/BetModal.tsx`、`fronted/components/sports/SportsBettingClient.tsx`
  - 客户端库：`fronted/lib/apiClient.ts`
- 后端
  - 兼容路由：`kmarket-backend/src/routes/compat.rs:190`（create）、`:252`（close）、`:82`（get positions）
  - DTO：`kmarket-backend/src/models/dto.rs:31`（FrontendPosition）
  - 视图保证：`kmarket-backend/src/state.rs:110`（ensure_positions_view）
  - 映射：`kmarket-backend/src/utils/mappers.rs:31`（map_position_row_to_frontend）
  - 仓储：`kmarket-backend/src/repository/order_repo.rs:111`（cancel_with_close_fields）

## 期望交付
- 统一后的下注入口与表单逻辑、错误码字典与前后端映射、幂等与签名落库与确认流、PnL/结算与审计扩展、统一 API 封装与安全加固；附带迁移脚本与完整测试。

请确认以上方案，我将开始按模块提交改动与测试脚本。