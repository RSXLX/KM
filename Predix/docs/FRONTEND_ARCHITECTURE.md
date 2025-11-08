# Predix 前端架构说明

> 本文面向开发人员，系统性说明 `/Predix/` 项目的前端架构、核心模块与前后端交互规范，帮助快速理解系统并进行开发对接。

## 目录索引

- [1. 架构分析](#1-架构分析)
  - [1.1 技术栈组成](#11-技术栈组成)
  - [1.2 项目目录结构](#12-项目目录结构)
  - [1.3 核心模块与依赖关系](#13-核心模块与依赖关系)
  - [1.4 状态管理方案](#14-状态管理方案)
  - [1.5 路由设计方案](#15-路由设计方案)
- [2. 功能模块分析](#2-功能模块分析)
  - [2.1 页面与业务模块](#21-页面与业务模块)
  - [2.2 核心功能点](#22-核心功能点)
- [3. 前后端交互规范](#3-前后端交互规范)
  - [3.1 接口调用方式](#31-接口调用方式)
  - [3.2 请求与响应数据结构](#32-请求与响应数据结构)
  - [3.3 错误处理机制](#33-错误处理机制)
  - [3.4 认证授权方案](#34-认证授权方案)
  - [3.5 数据格式约定](#35-数据格式约定)
- [4. 重要接口与示例代码](#4-重要接口与示例代码)
  - [4.1 市场 Markets](#41-市场-markets)
  - [4.2 持仓 Positions](#42-持仓-positions)
  - [4.3 用户统计 User Stats](#43-用户统计-user-stats)
  - [4.4 钱包余额 Wallet Balance](#44-钱包余额-wallet-balance)
  - [4.5 钱包记账 Wallet Ledger](#45-钱包记账-wallet-ledger)
  - [4.6 区块链事件 Event History](#46-区块链事件-event-history)
- [5. 关键配置说明](#5-关键配置说明)
  - [5.1 环境变量](#51-环境变量)
  - [5.2 构建与部署](#52-构建与部署)
  - [5.3 Next.js 配置](#53-nextjs-配置)
- [6. 开发建议与扩展思路](#6-开发建议与扩展思路)

---

## 1. 架构分析

### 1.1 技术栈组成

- 前端框架：Next.js 14（App Router） + React 18 + TypeScript 5
- 样式系统：Tailwind CSS、tailwindcss-animate、Radix UI（对话框、菜单、标签等）
- 动画图形：Framer Motion、Recharts
- 国际化：`next-intl` 依赖与 `lib/i18n-simple.ts` 简化方案并存（当前主要使用简化方案）
- 数据请求：原生 `fetch` 为主，项目中已引入 `@tanstack/react-query`（尚未大规模使用）
- Web3：
  - Solana：`@solana/wallet-adapter-react`、`@solana/web3.js`，内置 `Phantom`/`Solflare` 支持
  - EVM：`wagmi`、`viem`、`@rainbow-me/rainbowkit`（目前以占位为主）
- 后端/Serverless：Next.js Route Handlers（`app/api/*`），Netlify Functions（`netlify/functions/*`），MySQL 数据库（`mysql2/promise`）

参考：`package.json`、`next.config.js`、`netlify.toml`

### 1.2 项目目录结构

核心目录（省略非关键文件）：

- `app/`：Next.js App Router 页面与 API 路由
  - 页面：`page.tsx`（首页）、`markets/page.tsx`、`leaderboard/page.tsx`、`news/page.tsx`、`sports-betting/page.tsx`、`database-status/page.tsx`、`account/positions/page.tsx`
  - API：`api/bets`、`api/markets`、`api/positions`、`api/users/stats`、`api/wallet/balance`、`api/wallet-ledger`、`api/events/*`、`api/database/health`
- `components/`：通用 UI 与业务组件
  - `layout/`（`ResponsiveLayout`、`Sidebar`、`TopBar` 等）
  - `market/`（`MarketCard`、`BetModal` 等）
  - `sports/`（`SportsBettingClient`、`BetPanel`、`ClosePositionModal`、`LiveOddsChart` 等）
  - `ui/`（`dialog`、`button`、`card` 等基础组件）
  - `providers/WalletProvider.tsx`（Solana 钱包接入）
- `hooks/`：业务钩子（`useMarkets`、`useSportsBetting`、`useLiveDataSimulator`）
- `lib/`：工具库与业务层
  - `solana.ts`、`solana-ledger.ts`（Solana 网络、记账）
  - `web3.ts`（EVM 占位）
  - `crawler/`（内容抓取与市场映射）
  - `event-listener.ts`（链上事件监听与数据库落库脚本）
  - `database/schema.sql`（数据库表结构）
  - `config.ts`（导航等配置）
- `types/`：类型定义（`database.ts`、`sports.ts`）
- `netlify/functions/`：函数入口（如 `markets.ts`、`crawler.ts`）
- `messages/`：多语言文案 JSON（`en/zh/ja/ko.json`）

### 1.3 核心模块与依赖关系

- 页面层（App Router）：调用组件层与 `hooks`，通过 `fetch` 访问 `app/api/*` 或 Netlify Functions
- 组件层：
  - 布局组件（`layout/*`）负责响应式布局、导航、顶部栏
  - 业务组件（`market/*`、`sports/*`）负责交互与展示，内部通过 `hooks` 获取数据
- Hooks 层：
  - `useMarkets`：拉取市场数据（当前以 mock 为主）
  - `useSportsBetting`：赔率、下注、实时曲线模拟等业务逻辑与本地状态
  - `useLiveDataSimulator`：弱网/实时数据变化模拟
- Web3 层：
  - `WalletProvider` 提供 Solana 钱包上下文，业务组件通过 `useWallet` 获取地址进行交易与查询
  - `solana.ts`、`solana-ledger.ts` 封装 RPC、余额查询、记账
- API 层：
  - Next.js Route Handlers：`app/api/*`，直连 MySQL，返回 JSON
  - Netlify Functions：`netlify.toml` 将 `/api/*` 路由到 `/.netlify/functions/:splat`（生产静态导出下）
- 数据层：
  - MySQL：`positions`、`markets`、`users`、`user_stats`、`blockchain_events` 等表；`schema.sql` 定义
  - 事件监听：`lib/event-listener.ts` 解析链上事件，回填/同步到数据库，并可调用相关 API 进行重试/修复

### 1.4 状态管理方案

- 目前以「组件本地状态 + 自定义 Hooks + 原生 fetch」为主
  - 示例：`useSportsBetting` 使用 `useState/useEffect` 管理赔率、下注参数、实时曲线
  - `account/positions/page.tsx` 中直接 `fetch('/api/positions')` 拉取数据
- 已引入 `@tanstack/react-query`，但未广泛使用
  - 建议：将列表数据、分页、缓存、错误重试、乐观更新等迁移到 React Query 统一管理，提升数据一致性与容错

### 1.5 路由设计方案

- App Router 目录结构：
  - 顶层 `layout.tsx` 提供全局样式与 `WalletProvider`
  - 页面路径：
    - `/`（首页）
    - `/markets`（市场列表）
    - `/leaderboard`（排行榜）
    - `/news`（新闻）
    - `/sports-betting`（体育投注演示）
    - `/account/positions`（我的持仓）
    - `/database-status`（数据库健康检查）
    - `/football/[id]`（动态详情示例）
- API 路由：见 [3. 前后端交互规范](#3-前后端交互规范)
- 生产部署（Netlify）：
  - `netlify.toml` 将 `/api/*` 转发至 Netlify Functions；多语言根路径重定向（`/` -> `/en|/zh|/ja|/ko`）

---

## 2. 功能模块分析

### 2.1 页面与业务模块

- 首页（`app/page.tsx`）
  - 入口与基础布局，展示导航、主题区块
- Markets（`app/markets/page.tsx`）
  - 市场列表展示、分类筛选、趋势排序（`components/market/*`、`hooks/useMarkets`）
- Leaderboard（`app/leaderboard/page.tsx`）
  - 用户或市场排名展示（组件：`components/leaderboard/*`）
- News（`app/news/page.tsx`）
  - 新闻卡片与聚合（`components/news/*`）
- Sports Betting（`app/sports-betting/page.tsx`）
  - 体育赔率、下注交互、实时曲线模拟（`components/sports/*`、`hooks/useSportsBetting`）
- Account/Positions（`app/account/positions/page.tsx`）
  - 我的持仓、筛选、统计、平仓（依赖 `api/positions`、`api/users/stats`、`ClosePositionModal`）
- Database Status（`app/database-status/page.tsx`）
  - 数据库健康检查与性能指标（依赖 `api/database/health`）

### 2.2 核心功能点

- 市场数据：创建/更新/查询市场（`api/markets`）
- 下注开仓：记录开仓（`api/positions` POST），幂等基于 `transaction_signature`
- 平仓结算：创建平仓记录并更新原始开仓状态（`api/positions/close` POST）
- 用户统计：实时计算与历史统计融合（`api/users/stats`）
- 钱包：Solana 钱包连接（`WalletProvider`）、余额查询（`api/wallet/balance`）、记账（`api/wallet-ledger`）
- 事件日志：链上事件历史查询与重试（`api/events/history`）

---

## 3. 前后端交互规范

### 3.1 接口调用方式

- RESTful 约定，使用 HTTP 方法区分增删改查：`GET`/`POST`/`PUT`
- 调用路径：
  - 开发模式：`/api/*` 由 Next.js Route Handlers 提供
  - 生产模式（静态导出）：按 `netlify.toml` 转发到 `/.netlify/functions/*`（函数名需一一对应）

### 3.2 请求与响应数据结构

- 通用响应结构：

```json
{
  "ok": true,
  "message": "...",  // 可选
  "data": { ... }      // 或按资源返回顶层对象，如 markets/positions
}
```

- 错误响应结构：

```json
{
  "ok": false,
  "error": "错误说明",
  "code": "可选错误码"
}
```

- 分页规范：`page`、`limit`、`total`、`total_pages`，服务端限制 `limit<=100`

- 主要数据模型（见 `types/database.ts`）：
  - `Market`：`state`（1=Open，2=Closed，3=Resolved）、赔率 `odds_*_bps`
  - `Position`：`position_type`（OPEN/CLOSE）、`status`（见枚举）、金额单位 `lamports`
  - `UserStats`、`BlockchainEvent` 等

### 3.3 错误处理机制

- 服务端统一返回 `ok:false + error 文本 + 可选 code`，配合 HTTP 状态码：
  - `400`（参数缺失/非法）、`403`（归属校验失败）、`404`（资源不存在）、`409`（状态冲突，如市场已关闭）、`500`（数据库/内部错误）
- 幂等：部分写操作基于 `transaction_signature` 做重复检测（如开仓/平仓）
- 事务：写操作使用事务与 `FOR UPDATE` 行锁，减少并发不一致

### 3.4 认证授权方案

- 现状：前端以 Solana 钱包登录为主（`WalletProvider` + `useWallet`），接口多数通过 `wallet_address` 识别用户，无 JWT 校验
- 建议：
  - 在关键写操作（下注、平仓）加入签名校验或后端 JWT（结合钱包地址与签名换取短期令牌）
  - 区分只读接口与需要授权的接口，服务端校验 `wallet_address` 与交易归属关系

### 3.5 数据格式约定

- 日期时间：统一使用 ISO 8601 字符串（服务端部分返回 `Date`，前端展示/筛选请转换为 ISO）
- 金额单位：Solana 金额以 `lamports` 存储与传输，UI 层按 `1e9` 转换为 `SOL`
- 枚举：
  - `MarketState`：`Open=1`、`Closed=2`、`Resolved=3`、`Canceled=4`
  - `PositionStatus`：`Placed=1`、`SettledWin=2`、`SettledLose=3`、`Canceled=4`、`Refunded=5`、`ClosedEarly=6`

---

## 4. 重要接口与示例代码

> 以下示例均为前端使用 `fetch` 的调用示例，实际生产请结合统一的请求封装与错误处理。

### 4.1 市场 Markets

接口：`GET /api/markets`

查询参数：`market_address?`、`state?`、`page?`、`limit?`

示例：

```ts
// 查询最新市场列表
const res = await fetch('/api/markets?page=1&limit=20');
const data = await res.json();
// data: { ok: true, markets: Market[], pagination: {...} }
```

接口：`POST /api/markets`

请求体：`{ market_address, home_code, away_code, start_time, close_time, odds_home_bps, odds_away_bps, max_exposure, ... }`

```ts
const payload = {
  market_address: 'H1...abc',
  home_code: 1001,
  away_code: 1002,
  start_time: '2024-03-01T12:00:00Z',
  close_time: '2024-03-02T12:00:00Z',
  odds_home_bps: 18000,
  odds_away_bps: 21000,
  max_exposure: 1000000
};
const res = await fetch('/api/markets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const data = await res.json();
```

接口：`PUT /api/markets`

请求体：`{ market_address, state?, result?, current_exposure?, odds_home_bps?, odds_away_bps? }`

```ts
await fetch('/api/markets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market_address: 'H1...abc', state: 3, result: 1 }) });
```

### 4.2 持仓 Positions

接口：`POST /api/positions`（创建开仓）

请求体：`{ wallet_address, market_address, selected_team, amount, multiplier_bps, transaction_signature, odds_home_bps?, odds_away_bps? }`

```ts
const payload = {
  wallet_address: wallet.publicKey!.toBase58(),
  market_address: 'H1...abc',
  selected_team: 1, // 1=Home, 2=Away
  amount: 1000000,  // 1 SOL = 1e9 lamports
  multiplier_bps: 10000, // 1.0x
  transaction_signature: '5q...signature',
  odds_home_bps: 18000,
  odds_away_bps: 21000
};
const res = await fetch('/api/positions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const data = await res.json();
```

接口：`GET /api/positions`（查询持仓）

查询参数：`wallet_address?`、`market_address?`、`status?`、`position_type?`、`page?`、`limit?`

```ts
const qs = new URLSearchParams({ wallet_address: wallet.publicKey!.toBase58(), position_type: 'OPEN', status: '1', limit: '50' });
const res = await fetch(`/api/positions?${qs.toString()}`);
const data = await res.json();
```

接口：`POST /api/positions/close`（平仓）

请求体：`{ position_id, wallet_address, transaction_signature, close_price_bps?, close_fee_lamports? }`

```ts
const payload = {
  position_id: 123,
  wallet_address: wallet.publicKey!.toBase58(),
  transaction_signature: '8r...signature',
  close_price_bps: 19500,
  close_fee_lamports: 5000
};
const res = await fetch('/api/positions/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const data = await res.json();
```

### 4.3 用户统计 User Stats

接口：`GET /api/users/stats?wallet_address=...`

```ts
const res = await fetch(`/api/users/stats?wallet_address=${wallet.publicKey!.toBase58()}`);
const data = await res.json();
// data.stats: { total_positions, total_volume_lamports, win_rate, ... }
```

接口：`POST /api/users/stats`（后台任务重算统计）

```ts
await fetch('/api/users/stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet_address }) });
```

### 4.4 钱包余额 Wallet Balance

接口：`GET /api/wallet/balance?address=...&mints=USDC,USDT`

```ts
const res = await fetch(`/api/wallet/balance?address=${wallet.publicKey!.toBase58()}&mints=${encodeURIComponent('EPjF...,Es9v...')}`);
const data = await res.json();
// data: { address, network, endpoint, balances: [{ mint, amount, decimals }], lastUpdatedAt }
```

### 4.5 钱包记账 Wallet Ledger

接口：`POST /api/wallet-ledger`

```ts
await fetch('/api/wallet-ledger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet, signature, direction: 'debit', deltaLamports: 10000, deltaSol: 0.00001, reason: 'bet', fixtureId: 'fixture-001' }) });
```

接口：`GET /api/wallet-ledger?wallet=...`

```ts
const res = await fetch(`/api/wallet-ledger?wallet=${wallet.publicKey!.toBase58()}`);
const data = await res.json();
```

### 4.6 区块链事件 Event History

接口：`GET /api/events/history`

查询参数：`event_type?`、`start_date?`、`end_date?`、`has_error?`、`page?`、`limit?`

```ts
const qs = new URLSearchParams({ event_type: 'EventBetPlaced', has_error: 'false', page: '1', limit: '20' });
const res = await fetch(`/api/events/history?${qs.toString()}`);
const data = await res.json();
```

接口：`POST /api/events/history`（重试失败事件）

```ts
await fetch('/api/events/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventIds: [1,2,3] }) });
```

---

## 5. 关键配置说明

### 5.1 环境变量

参考 `.env.example`：

- 钱包与链配置：
  - `NEXT_PUBLIC_SOLANA_NETWORK`：`mainnet-beta|devnet|testnet`
  - `NEXT_PUBLIC_SOLANA_RPC_URL`：可选自定义 RPC
  - `NEXT_PUBLIC_USDC_MINT`、`NEXT_PUBLIC_USDT_MINT`：过滤余额时使用
- 数据库：
  - `MYSQL_URL`（推荐统一配置，形如 `mysql://user:pass@host:3306/db?ssl=true`）
  - 或 `DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME|DB_SSL`
- 事件监听：
  - `EVENT_LISTENER_ENABLED`、`EVENT_LISTENER_SYNC_INTERVAL`、`EVENT_LISTENER_BATCH_SIZE` 等
- API 基础：
  - `NEXT_PUBLIC_API_BASE_URL`：事件重试等内部调用基址（开发可留空使用相对路径）
- 安全：
  - `API_SECRET_KEY`：服务端密钥（用于函数鉴权或签名校验的扩展）
  - `CORS_ORIGINS`：允许来源列表

### 5.2 构建与部署

- `next.config.js`：生产时 `output: 'export'` 静态导出，`distDir: 'out'`
- `netlify.toml`：
  - `/api/*` 转发至 `/.netlify/functions/:splat`
  - 多语言根重定向 `/` -> `/en|/zh|/ja|/ko`
  - 函数打包 `esbuild`、超时设置（`markets: timeout=10`）

### 5.3 Next.js 配置

- 远程图片域名白名单：`images.unsplash.com`、`espn.com` 等
- 客户端构建 fallback：禁用 `fs/net/tls` 等 Node 核心模块
- 别名：客户端侧禁用 `@netlify/functions`

---

## 6. 开发建议与扩展思路

- 数据层一致性：
  - 将所有写操作（开仓/平仓/结算）统一通过后端签名校验或 JWT 授权，减少仅凭 `wallet_address` 的风险
  - 对幂等请求（含 `transaction_signature`）统一抽象校验中间件
- 状态管理进阶：
  - 引入 React Query 管理 `markets`、`positions`、`stats` 等资源，封装 `useQuery/useMutation` 与缓存策略
  - 对弱网场景（50ms-500ms）加入请求重试与指数退避、版本号控制和状态快照（用于断线重连恢复）
- API 统一封装：
  - 建立 `lib/api.ts` 封装 `fetch`、错误规范、分页解析、类型映射，避免各处重复处理
- 生产部署：
  - 为非 Netlify Functions 的接口在 `netlify/functions` 下补齐同名函数，确保 `/api/*` 在静态导出场景可用
- 观测与排错：
  - 完善 `api/database/health` 与事件重试监控页面；对 `blockchain_events` 的错误增加重试策略与报警

---

如需补充接口或新增模块，请在本文件对应章节追加，并在 `netlify/functions` 与 `app/api/*` 保持一致的路由与数据结构。