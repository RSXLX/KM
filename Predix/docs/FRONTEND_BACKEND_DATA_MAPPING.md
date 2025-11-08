# 前后端数据结构对比与适配指南（Predix ↔ kmarket-backend）

> 目的：系统对比前端与后端的数据结构与接口差异，给出明确的映射/适配规则、示例代码与集成步骤，帮助快速修复“前端不能正确调用后端接口”的问题。

---

## 总览与基址

- 前端基址（环境变量）：
  - `NEXT_PUBLIC_API_BASE_URL`（示例：`http://127.0.0.1:8080/api/v1`）
- 后端 Scope：统一为 `/api/v1/*`；常用端点：
  - 健康/就绪：`GET /healthz`、`GET /readyz`
  - 市场：`GET /markets`、`GET /markets/{id}`、`GET /markets/active`
  - 赔率：`GET /odds/{market_id}`
  - 下注：`POST /bets`、`GET /bets`、`GET /bets/{order_id}`、`POST /bets/{order_id}/claim`
  - 会话与 JWT：`GET /auth/nonce`、`POST /auth/verify-sig`、`GET /auth/me`

---

## 端点与数据结构对比

### 1) 市场列表：`GET /api/v1/markets`

- 后端响应（简化）：
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 120,
  "items": [
    {
      "id": 1001,                 // 后端: market_id 映射为 id（已在查询中转换）
      "league": "NBA",           // 后端: category → league
      "title": "Lakers vs Celtics",
      "status": "active",        // 后端: enum → text（查询中使用 status::text as status）
      "start_time": 1730945234000, // opened_at/created_at → 毫秒时间戳
      "odds": {
        "moneyline": { "home": 1.85, "away": 1.95 },
        "spread": null,
        "total": null,
        "timestamp": 1730945234000,
        "source": "db|cache"
      }
    }
  ]
}
```
- 前端类型（`lib/api.ts`）：
```ts
export type MarketListItem = {
  id: number;
  league: string;    // 映射自后端 category
  title: string;
  status: string;    // 文本
  start_time?: number | null;
  odds?: any | null; // moneyline/spread/total 复合结构
};
```
- 差异与适配：
  - 字段名：`category` → `league`（已在后端查询层规范输出）。
  - 状态：后端原为 enum `market_status`，查询中转换为文本，前端可直接显示。
  - `start_time`：后端以 opened_at/created_at 映射；前端以毫秒数展示。
  - `odds`：复合结构，moneyline 优先；若无复合结构时可回退旧字段（见下）。

### 2) 活跃市场快照：`GET /api/v1/markets/active`

- 后端响应：
```json
{
  "source": "db|cache|degraded",
  "data": [ { "market_id": 1001, "title": "Lakers vs Celtics", "category": "NBA" } ]
}
```
- 前端（目标使用 `useActiveMarkets`）：
```ts
export type ActiveMarket = { market_id: number; title: string; category: string };
```
- 差异与适配：
  - 前端展示组件 `LiveMatch` 需要 `teams.home.name/away.name` 等：
    - 适配规则：从 `title` 以 `/\s+vs\s+/i` 拆分为 Home/Away 名称。
    - `sport/league` 可统一用 `category`。

### 3) 市场详情：`GET /api/v1/markets/{id}`

- 后端响应（简化）：
```json
{ "market": { "market_id": 1001, "title": "Lakers vs Celtics", "category": "NBA", ... },
  "odds": { "moneyline": { "home": 1.85, "away": 1.95 }, "timestamp": 1730945234, "source": "db|cache" } }
```
- 差异与适配：
  - `title` 拆分队名；若不存在 moneyline 则回退旧字段（见下）。

### 4) 赔率：`GET /api/v1/odds/{market_id}`

- 后端响应：
```json
{
  "marketId": 1001,
  "odds_a": 185,               // 旧字段（bps）
  "odds_b": 195,               // 旧字段（bps）
  "moneyline": { "home": 1.85, "away": 1.95 },
  "spread": null,
  "total": null,
  "timestamp": 1730945234,
  "source": "cache|db"
}
```
- 前端类型（`lib/api.ts`）：
```ts
export type OddsResponse = {
  marketId: number;
  odds_a: number;   // bps
  odds_b: number;   // bps
  moneyline?: { home: number; away: number } | null;
  spread?: { line: number; home: number; away: number } | null;
  total?: { line: number; over: number; under: number } | null;
  timestamp: number;
  source: string;
};
```
- 差异与适配：
  - 赔率单位：
    - moneyline 为小数（1.85）。
    - 旧字段 `odds_a/odds_b` 为 bps（185 → 1.85）。
  - 适配策略：优先使用 `moneyline`；若缺失则 `odds_a/100` 与 `odds_b/100` 作为回退。

### 5) 下注订单：`POST /bets` / `GET /bets` / `GET /bets/{id}` / `POST /bets/{id}/claim`

- 后端响应（订单条目）：
```json
{
  "orderId": 1730945234001,
  "userAddress": "0xuser-demo",
  "marketId": 1001,
  "amount": "10000",           // 字符串（numeric）
  "odds": 185,                  // bps 整数
  "option": 1,
  "potentialPayout": "18500",  // 字符串（numeric）
  "settled": false,
  "claimed": false,
  "txHash": "0x..."
}
```
- 前端期望（`lib/api.ts`）：基本一致，但需要适配为旧 Position UI：
  - 金额/潜在收益：字符串 → BigInt → Number（或安全格式化）。
  - 赔率：bps → 小数显示（`odds/100`）。
  - 旧 Position 字段映射示例（见下文适配器）。

### 6) 错误体

- 后端错误体统一：`{ code: string, message: string }` + HTTP 状态码。
- 前端 `apiFetch` 已统一解析；超时抛 `code='NETWORK_TIMEOUT'`，并通过全局拦截器触发 Toast/Loading。

---

## 发现的主要差异与原因

- 字段命名：后端使用 `category`、`market_id`；前端展示期望 `league`、`id`。
- 结构层级：`/markets/active` 返回 `{ source, data }`，前端组件通常期望直接是数组；需要取 `data`。
- 赔率单位：后端保留旧的 bps 字段与新 moneyline；前端组件统一展示为小数，需要优先 moneyline、回退转换 bps。
- 金额类型：后端金额为字符串（大整数），前端部分 UI 逻辑使用 Number，需要安全转换或保持字符串格式化展示。
- LiveMatch 展示：后端没有 LiveMatch 结构，前端需从 `title` 拆分队名，并补充 `status.isLive` 等。

---

## 适配规则与示例代码

### 将 ActiveMarket 映射为 LiveMatch
```ts
function fromActiveToLiveMatch(it: { market_id: number; title: string; category: string }): LiveMatch {
  const [homeNameRaw, awayNameRaw] = String(it.title || 'Home vs Away').split(/\s+vs\s+/i);
  const homeName = (homeNameRaw || 'Home').trim();
  const awayName = (awayNameRaw || 'Away').trim();
  return {
    id: String(it.market_id),
    sport: it.category || 'Sports',
    teams: { home: { name: homeName }, away: { name: awayName } },
    status: { isLive: true, time: 'Live' },
    marketUrl: `/sports-betting?fixtureId=${it.market_id}`,
    league: it.category || 'Sports'
  };
}
```

### 统一赔率展示（moneyline 优先，bps 回退）
```ts
function normalizeOdds(resp: OddsResponse) {
  const moneyline = resp?.moneyline;
  const home = typeof moneyline?.home === 'number' ? moneyline.home : (typeof resp?.odds_a === 'number' ? resp.odds_a / 100 : undefined);
  const away = typeof moneyline?.away === 'number' ? moneyline.away : (typeof resp?.odds_b === 'number' ? resp.odds_b / 100 : undefined);
  return { home, away, spread: resp?.spread ?? null, total: resp?.total ?? null, timestamp: resp?.timestamp, source: resp?.source };
}
```

### 订单到旧 Position UI 的最小映射（已实现于 `lib/bets.ts`）
```ts
export function orderToLegacyPosition(o: OrderResp): any {
  const amountLamports = safeBigInt(o.amount);
  const payoutLamports = o.potentialPayout ? safeBigInt(o.potentialPayout) : 0n;
  return {
    id: o.orderId,
    wallet_address: o.userAddress,
    market_address: String(o.marketId),
    position_type: o.settled ? 'CLOSE' : 'OPEN',
    selected_team: o.option,
    amount: Number(amountLamports),
    multiplier_bps: o.odds, // bps
    payout_expected: Number(payoutLamports),
    status: o.settled ? (o.claimed ? 2 : 6) : 1,
    is_claimed: o.claimed,
    pnl: 0,
    fee_paid: 0,
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    market: { home_team: 'HOME', away_team: 'AWAY', status: o.settled ? 2 : 1 },
  };
}
```

---

## 集成步骤（已实施/建议）

- 使用 Hooks：
  - 活跃市场：`useActiveMarkets({ forceRefresh: true })` → 统一 data/loading/error。
  - 赔率：`useOdds(marketId, { refetchInterval?: number })` → 统一展示与自动刷新（可选频率）。
- 组件改造：
  - `LiveInPlayGrid` 与 `MainContent` 已替换为 `useActiveMarkets` 数据源，移除独立请求逻辑；弱网降级保留。
  - `SportsBettingClient` 接入 `useActiveMarkets` + `useOdds`，保持 UI 与旧逻辑一致，并优先使用 hook 赔率。
- 错误与 Loading：
  - 使用全局 `RequestProvider` 拦截器（`lib/api.ts`），统一 Loading 条与 Toast。
- 缓存与刷新：
  - React Query：`staleTime=30s（活跃）/10s（赔率）`，`retry=2`；可选 `refetchInterval` 用于实时更新。

---

## 测试清单

- 接口连通性：
  - `GET /api/v1/markets` 返回列表并含 `status` 文本与 `odds` 结构。
  - `GET /api/v1/markets/active` 返回 `{ data: ActiveMarket[] }`。
  - `GET /api/v1/odds/{id}` 返回 moneyline 或旧 bps 字段。
  - `POST /api/v1/bets` 与 `POST /api/v1/bets/{id}/claim` 正常工作（金额字符串、赔率 bps）。
- 组件功能：
  - Live/In-Play 与首页：活跃市场展示正确、弱网降级工作、无重复请求。
  - Sports Betting：当 `fixtureId` 匹配活跃市场时，自动对齐 `matchData` 与赔率；未匹配时合理 fallback。
- 性能：
  - 首屏无显著卡顿；刷新频率不引起抖动；Loading/Toast 行为一致。

---

## 常见坑位与建议

- Windows 开发环境：`Predix/.next/trace` 权限异常可能导致编译或预览异常；建议删除 `.next` 后重启 dev。
- 标题拆分：`title` 必须包含 `"Home vs Away"` 格式；否则需要兜底文案（如 `Unknown`）。
- 金额/赔率类型：金额为字符串（可能超出 JS Number 精度），显示时尽量格式化字符串或使用 BigInt；赔率统一小数展示。
- 多处使用同一数据：建议在顶层挂载 `ActiveMarketsProvider`（保留在 `hooks/useActiveMarkets.tsx`），再在各页面使用 `useActiveMarkets`，减少重复请求并保证一致性。

---

## 参考文件

- 前端：
  - `Predix/lib/api.ts`（API 客户端与错误处理、拦截器）
  - `Predix/hooks/useActiveMarkets.tsx`（活跃市场 Hook）
  - `Predix/hooks/useOdds.ts`（赔率 Hook，支持 refetchInterval）
  - `Predix/components/sports/LiveInPlayGrid.tsx`、`Predix/components/layout/MainContent.tsx`（已切换到 Hook）
  - `Predix/components/sports/SportsBettingClient.tsx`（已接入 ActiveMarkets+Odds）
  - `Predix/lib/bets.ts`（下注 API + 旧 UI 适配器）
- 后端：
  - `kmarket-backend/src/routes/markets.rs`、`markets_active.rs`、`odds.rs`、`bets.rs`（接口与数据结构）

---

如需我继续把 `useOdds` 接入 WebSocket 实时更新（`/ws/odds`），或将顶层统一挂载 `ActiveMarketsProvider` 以跨页面共享缓存，我可以直接实施并再次进行端到端预览验证。