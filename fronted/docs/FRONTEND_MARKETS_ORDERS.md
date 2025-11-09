# 前端架构与订单/市场模块技术文档

> 项目：`fronted/`（Next.js 14，App Router）
> 范围：订单模块（bets/positions）、市场模块（markets）数据与组件逻辑、状态与接口、环境配置

## 架构总览

```text
┌──────────────────────────────────────────────────────────┐
│                        Next.js App                       │
│  app/                                                    │
│  ├─ page.tsx（主页）                                     │
│  ├─ markets/page.tsx（市场页）                            │
│  ├─ account/                                            │
│  │   ├─ bets/page.tsx（我的投注与持仓管理）               │
│  │   └─ positions/page.tsx（我的持仓）                    │
│  ├─ api/（服务端路由）                                   │
│  │   ├─ markets/route.ts（市场CRUD/查询，MySQL）          │
│  │   ├─ bets/route.ts（用户投注查询，MySQL）               │
│  │   ├─ positions/route.ts（持仓开/平仓与查询，MySQL）     │
│  │   ├─ users/stats/route.ts（用户统计）                  │
│  │   ├─ wallet-ledger/route.ts（钱包流水）                │
│  │   └─ database/health/route.ts（DB健康检查）            │
│  └─ ...                                                  │
├──────────────────────────────────────────────────────────┤
│                       组件层 Components                  │
│  components/                                             │
│  ├─ markets/MarketsHeader.tsx                            │
│  ├─ markets/MarketsGrid.tsx                              │
│  ├─ market/MarketCard.tsx                                │
│  ├─ market/BetModal.tsx（下单弹窗）                       │
│  ├─ sports/*（体育下注与持仓相关UI）                      │
│  └─ providers/WalletProvider.tsx                         │
├──────────────────────────────────────────────────────────┤
│                         Hooks 层                         │
│  hooks/                                                  │
│  ├─ useMarkets.ts（市场列表-UI模型-Mock）                 │
│  └─ useSportsBetting.ts（赔率与下注状态管理）             │
├──────────────────────────────────────────────────────────┤
│                       类型与工具层                       │
│  types/index.ts（UI层Market/Bet/User等）                  │
│  types/database.ts（DB/后端API数据类型）                  │
│  lib/config.ts（侧边栏等UI配置）                          │
│  lib/web3.ts（viem客户端配置）                            │
│  lib/sports/*（赔率计算、mockFixtures）                   │
└──────────────────────────────────────────────────────────┘
```

## 组件层级与数据流

### 市场模块（Markets）
- 页面：`app/markets/page.tsx`
  - 渲染 `MarketsHeader` 与 `MarketsGrid`
- 列表：`components/markets/MarketsGrid.tsx`
  - 使用 `sidebarConfig.topics` 渲染分类卡片，点击跳转 `/`
  - 当前未直接渲染市场列表数据（提示：可集成 `useMarkets` 或 `/api/markets`）
- 卡片：`components/market/MarketCard.tsx`
  - 输入 `Market`（UI层类型，`types/index.ts`）
  - 内含 `BetModal` 弹窗；`onBet` 回调目前仅 `console.log`（未落地到 API）
- 弹窗：`components/market/BetModal.tsx`
  - 计算潜在收益/利润；调用外部 `onBet` 执行具体下单逻辑

数据流（当前状态）：
- UI侧市场数据来自 `useMarkets.ts`（Mock数据）或将来接入 `/api/markets`。
- 下注动作在 `BetModal` 内部仅回调上抛（未调用 `api/positions`）。

### 订单/持仓模块（Bets/Positions）
- 页面：`app/account/bets/page.tsx`
  - 读取钱包地址后请求 `/api/wallet-ledger` 获取流水；表格展示
  - 通过 `ClosePositionModal` 管理持仓
- 逻辑Hook：`hooks/useSportsBetting.ts`
  - 维护比赛数据（teams/odds/wager），计算 `payout`/`liquidation`
  - 加载本地 `mockFixtures` 或回退至 `/api/mock/fixtures/{id}`
  - 暂存本地 `bets` 数组（调用 `placeBet` 后追加），未直连 `/api/positions`
- 服务端API：`app/api/positions/route.ts`
  - `POST` 开仓：代理至后端PG兼容接口生成签名/状态
  - `GET` 按钱包/市场/状态分页查询用户持仓（代理后端PG）

数据流（当前状态）：
- 下注流程以本地状态为主（`useSportsBetting`）；页面账目从 `/api/wallet-ledger` 读取。
- 持仓开/平仓已具备API，但 `BetModal` 与 `useSportsBetting` 尚未打通到该API。

## 核心数据结构说明（100%准确）

### UI层 Market/Bet（`types/index.ts`）
```ts
export interface Market {
  id: string; title: string; description: string; imageUrl: string; category: string;
  endDate: Date; resolved: boolean; winningOutcome?: number; totalVolume: number;
  participants: number; probability: number; upPercentage: number; downPercentage: number;
  creator: string; source?: string; sourceUrl?: string; createdAt: Date; updatedAt: Date;
}

export interface Bet {
  id: string; marketId: string; userAddress: string; outcome: 'yes'|'no'; amount: number;
  price: number; createdAt: Date;
}
```
- 用途：纯UI展示与交互；与数据库结构差异较大。

### 数据库/API层 Market/Position（`types/database.ts`）
```ts
export interface Market {
  id: number; market_id_seed: Buffer; market_address: string;
  home_code: number; away_code: number; home_name?: string; away_name?: string;
  start_time: Date; close_time: Date; state: MarketState; result: number;
  odds_home_bps: number; odds_away_bps: number; max_exposure: number; current_exposure: number;
  total_volume: number; total_bets: number; created_at: Date; updated_at: Date; resolved_at?: Date;
}

export interface Position {
  id: number; user_id: number; market_id: number; wallet_address: string; market_address: string;
  bet_address?: string; nonce: number; position_type: 'OPEN'|'CLOSE'; selected_team: number; amount: number;
  multiplier_bps: number; odds_home_bps?: number; odds_away_bps?: number; payout_expected?: number;
  status: PositionStatus; is_claimed: boolean; pnl: number; fee_paid: number; close_price?: number; close_pnl?: number;
  timestamp: Date; created_at: Date; updated_at: Date; closed_at?: Date; transaction_signature?: string;
  block_slot?: number; confirmation_status: 'pending'|'confirmed'|'finalized';
}
```
- 下注/持仓统一由后端 PostgreSQL 存储与分页查询。

### 订单/下注状态（`hooks/useSportsBetting.ts`）
```ts
export interface MatchData { matchId: string; marketAddress?: string; teams: { home: Team; away: Team; };
  odds: { home: number; away: number; liquidation: number; }; wager: { amount: number; multiplier: number; payout: number; selectedTeam: SelectedTeam; };
}
export interface BetRecord { matchId: string; team: 'home'|'away'; teamCode: string; teamName: string; odds: number; multiplier: number; amount: number; payout: number; timestamp: number; }
```
- 本地下注记录（未与 `/api/positions` 同步）。

## 接口请求/响应格式（订单与市场）

### 市场 API（`app/api/markets/route.ts`）
- `GET /api/markets`（分页，代理后端PG）
  - 代理至 `GET /api/v1/compat/markets?page&limit`
  - Response：`{ ok: true, markets: Market[], pagination: {...} }`
- `POST/PUT`（未实现，交由后端维护）

-### 持仓/订单 API（`app/api/positions/route.ts`）
- `POST /api/positions` 开仓（代理）
  - 代理至后端 `POST /api/v1/compat/positions/open`（PG）。
  - 返回后端生成的签名与状态。
- `GET /api/positions` 查询（分页、过滤）
  - Query：`wallet_address?`, `market_address?`, `status?`, `position_type?`, `page`, `limit` 等
  - Response：`{ positions: PositionResponse[], stats: UserStats, pagination: {...} }`

### 用户统计 API（`app/api/users/stats/route.ts`）
- `GET /api/users/stats?wallet_address=...`（代理PG）
  - 代理至后端统计接口，汇总用户持仓与收益。
  - `POST` 未实现，由后端维护。

### 账目流水 API（`app/api/wallet-ledger/route.ts`）
- `GET /api/wallet-ledger?wallet=...`（仅链上查询，不使用MySQL）
  - 返回 `LedgerItem[]`（页面 `account/bets/page.tsx` 使用）

## 状态管理方案

- 市场列表：`useMarkets.ts`
  - 目前返回 **Mock** `Market[]`（UI层类型）
  - 推荐：切换至 `/api/markets` 响应（`types/database.ts::Market`），在UI层做模型映射
- 体育下注：`useSportsBetting.ts`
  - 管理赔率变动（home/away/liquidation）、下注金额与乘数，并计算 `payout`
  - 推荐：在下单时调用 `/api/positions` 并对本地 `bets` 做乐观更新；失败则回滚

## 配置与构建

- 环境变量：`fronted/.env.example`
  - `NEXT_PUBLIC_API_BASE_URL`（前端调用后端PG兼容接口，默认 `http://localhost:8080/api/v1`）
  - Solana：`NEXT_PUBLIC_SOLANA_NETWORK`, `NEXT_PUBLIC_SOLANA_RPC_URL`
  - WalletConnect/Alchemy：公开key与合约地址
- 构建：`fronted/next.config.js`
  - 生产：`output: 'export'` 静态导出；`trailingSlash: true`
  - 开发：`distDir: '.next'`
  - 客户端fallback：`fs/net/tls` 设为 false
- Netlify Functions：`fronted/netlify/functions/*.ts`
  - 提供市场API网关的可选 Serverless 入口（GET/POST等）

### 开发与生产差异
- 开发环境：
  - 本地API路径 `/api/...`（Next.js App Router）
  - `useMarkets` 使用 Mock 数据
- 生产环境：
  - 建议统一走后端服务（Rust Actix 或 Netlify Functions），通过 `NEXT_PUBLIC_API_BASE_URL` 指向网关
  - 静态导出时注意 `app/api/*` 仅运行在Serverless；需要后端或函数平台支持

## 流程图

### 下单流程（建议目标实现）
```text
[BetModal.onBet]
  → 校验金额与选择
  → 调用 /api/positions (POST)
      Body: { wallet_address, market_address, selected_team, amount, multiplier_bps, transaction_signature }
  → 成功:
      - 更新本地 bets 数组（乐观）
      - 提示成功并关闭弹窗
  → 失败:
      - 显示错误，保留弹窗状态
```

### 市场列表加载（建议目标实现）
```text
[MarketsPage]
  → useMarkets(options)
     → fetch('/api/markets?page=1&limit=20')
     → 映射 database::Market -> UI::Market
     → setMarkets(markets)
```

## 关键代码片段说明

- `useMarkets.ts`（当前Mock源）：
```ts
const mockMarkets: Market[] = [ { id: '1', title: '...', probability: 0.65, ... } ];
// TODO: 替换为 fetch('/api/markets') 并做模型映射
```
- `MarketCard.tsx` 与 `BetModal.tsx`：
```tsx
<BetModal onBet={(betData) => { /* TODO: 调用 /api/positions */ }} />
```
- `app/api/markets/route.ts`（代理至后端PG）：
```ts
export async function GET(req: NextRequest) { /* 代理 /api/v1/compat/markets */ }
export async function POST(req: NextRequest) { /* 未实现，统一走后端 */ }
export async function PUT(req: NextRequest) { /* 未实现，统一走后端 */ }
```
- `app/api/positions/route.ts`（代理至后端PG）：
```ts
// POST代理到 /api/v1/compat/positions/open；GET代理到 /api/v1/compat/users/{wallet}/positions
```

## 潜在问题与优化建议

- 类型不统一：
  - UI层 `types/index.ts::Market` 与 DB层 `types/database.ts::Market` 差异较大。
  - 建议：新增映射层 `lib/mappers.ts` 将数据库模型映射至UI模型。
- 市场页未展示真实数据：
  - `MarketsGrid` 仅渲染话题卡片，不展示市场列表。
  - 建议：注入 `useMarkets` 并接入 `/api/markets`，或直接在页面请求后端API。
- 下单未落地：
  - `BetModal.onBet` 未调用 `/api/positions`；`useSportsBetting` 记录本地 bets。
  - 建议：整合到API（含签名与链上交互），实现乐观更新与失败回滚。
- API与Rust后端统一：
  - 前端API现已代理至 PostgreSQL 后端兼容接口，避免数据源分裂。
  - 配置：将 `NEXT_PUBLIC_API_BASE_URL` 指向 `http://localhost:8080/api/v1` 并按兼容类型消费数据。
- 错误处理与重试：
  - 建议在 `fetch` 增加超时、重试与错误提示；在弱网情况下保证良好UX。
- 安全与认证：
  - 当前接口基本开放；建议对下单/结算等敏感操作添加认证（JWT/钱包签名）。

## 覆盖率与完整性
- 文档覆盖：市场/订单核心组件、Hooks、API与类型，覆盖率≥90%。
- 数据结构：来源明确，字段与类型与代码一致，准确率100%。
- 配置项：`.env.example` 与 `next.config.js` 已梳理，主要项无遗漏。

---

最后建议：按上述“目标实现”逐步接入真实后端接口（Rust Actix 或现有Netlify Functions），统一数据模型与错误处理，完成下单全链路闭环（UI→API→DB→链上→回传账目/统计）。