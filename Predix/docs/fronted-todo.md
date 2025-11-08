# Frontend TODO（Predix ↔ kmarket-backend 联调）

- 日期：2025-11-06
- 目标：将 Predix 前端与 `kmarket-backend` 完成接口与协议对齐，统一为 `/api/v1/*`（REST）与 `/ws/*`（WebSocket）。
- 参考文档：
  - 后端：《kmarket-backend/docs/FRONTEND_HANDOFF_20251106.md》
  - 前端：《Predix/docs/FRONTEND_ARCHITECTURE.md》

---

## 高优先级（本周完成）

- [x] 统一 API 基址与版本前缀
  - 新增环境变量：`NEXT_PUBLIC_API_BASE_URL`（如 `http://127.0.0.1:8080/api/v1`）
  - 替换现有 `fetch('/api/...')` 为 `fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/...`
  )`，保留 Netlify Functions 仅用于旧接口或静态导出。

- [x] 接入 EVM JWT 登录（EIP-191）
  - UI：新增“EVM 钱包登录”（维持 Solana 登录不变）
  - 流程：
    1) `GET /api/v1/auth/nonce?address=<0x..>`
    2) 钱包签名 `Login to KMarket: nonce=<uuid>`（wagmi/viem）
    3) `POST /api/v1/auth/verify-sig` → 获取 JWT
    4) 将 `Authorization: Bearer <jwt>` 注入所有受保护请求
  - 存储：JWT 仅保留内存/IndexedDB，支持自动刷新或登出。

- [ ] 市场页对接（/markets）
  - 列表：`GET /api/v1/markets`（分页）
  - 详情：`GET /api/v1/markets/{id}`（聚合赔率）
  - 活动快照：`GET /api/v1/markets/active`（缓存优先）
  - 类型映射：新增 `moneyline/spread/total`，保留旧 `odds_a/odds_b` 兼容。

- [x] 赔率读取与实时更新
  - REST：`GET /api/v1/odds/{market_id}`（兼容旧字段）
  - WS 握手：`GET /ws/odds?token=<jwt>`，消息 `subscribe|unsubscribe|resume`，ACK 与增量处理。
  - 断线补全：`GET /api/v1/markets/{id}/odds/updates?since_seq=<last>`。

- [ ] 下注/订单页（替代或并存于现有 Positions）
  - 下单：`POST /api/v1/bets`（字段：`marketId`, `option`, `amount:string`, `odds:int(bps)`）
  - 列表：`GET /api/v1/bets?userAddress=...&marketId=...&status=...`
  - 详情：`GET /api/v1/bets/{order_id}`
  - 领取：`POST /api/v1/bets/{order_id}/claim`
  - 注意：金额为字符串（大整数），赔率为 bps（185→1.85）。

- [x] 错误处理统一
  - 解析后端错误体：`{ code: string, message: string }`；按 HTTP 状态码映射 UI（Toast/Dialog）。
  - 对关键动作（下注/领取）加入重试与幂等提示。

---

## 中优先级（两周内）

- [x] 封装前端 API 客户端（`lib/api.ts`）
  - 基础：`baseURL`、`headers`（含 `Authorization`）、统一错误解析、分页工具。
  - 钩子：`useMarketsQuery/useOddsQuery/useBetsQuery/useAuth`（建议基于 React Query）。

- [x] WebSocket 客户端封装
  - `lib/ws.ts`：握手、订阅管理、ACK、断线重连、`resume` 与 REST 增量补全。
  - 弱网策略：指数退避、心跳超时上报；与 UI 状态联动（“连接中/已断开/已恢复”）。

- [x] UI 与类型统一
  - 新增类型：`OddsQuote`（`moneyline/spread/total`）、`OrderResp`。
  - 统一时间戳单位为 ms；金额展示（字符串→BigInt/Decimal→格式化）。

- [ ] 管理页（如有）
  - 接入：`POST /api/v1/admin/markets`、`PUT /api/v1/admin/markets/{id}`、`POST /api/v1/admin/odds/override`、`POST /api/v1/admin/markets/{id}/settle`。
  - 权限：JWT 角色需为 `admin`。

---

## 低优先级（持续优化）

- [ ] 前端路由与旧接口迁移计划
  - 逐步替换 Next.js Route Handlers/Netlify Functions 的 `/api/*` 为后端服务；保留仅前端侧数据的函数。

- [ ] React Query 引入与数据一致性
  - 缓存、错误重试、乐观更新、客户端分页；统一全局 Loading/错误边界。

- [ ] 观测与日志
  - 上报 WS 连接状态、广播延迟（p95）、请求耗时；前端埋点与后端 `/api/v1/ws/health` 对齐。

---

## 接口映射清单（旧 → 新）

| 前端文档中的接口/模块 | 新后端接口 | 说明 |
|---|---|---|
| `/api/markets` (Next) | `GET /api/v1/markets` | 统一版本前缀；分页参数保持 |
| `POST /api/markets` (Next) | `POST /api/v1/admin/markets` | 管理端；需 JWT admin |
| `PUT /api/markets` (Next) | `PUT /api/v1/admin/markets/{id}` | 管理端更新 |
| `GET /api/positions` | `GET /api/v1/bets` | 语义差异：bets 订单 vs positions；页面适配 |
| `POST /api/positions` | `POST /api/v1/bets` | 下单；金额字符串 + 赔率 bps |
| `POST /api/positions/close` | `POST /api/v1/bets/{order_id}/claim` | 语义：领取 vs 平仓；UI 文案需调整 |
| `api/users/stats` | 暂无 | 后端未提供；保留前端计算或后续补充接口 |
| `api/events/*` | 暂无 | 后端提供 `chain_events` 表，但无 REST；后续规划 |
| 钱包余额/记账 | 暂无 | 当前后端不提供；保留 Solana 流程 |
| WS（模拟/本地） | `GET /ws/odds` + REST updates | 统一握手与增量补全 |

---

## 新增/修改的环境变量（前端）

- `NEXT_PUBLIC_API_BASE_URL`：后端 REST 基址（如 `http://127.0.0.1:8080/api/v1`）
- `NEXT_PUBLIC_WS_URL`：WS 基址（如 `ws://127.0.0.1:8080/ws/odds`）
- `NEXT_PUBLIC_JWT_ISS`、`NEXT_PUBLIC_JWT_AUD`：后端校验一致（与后端配置相同）

---

## 代码片段（示例）

```ts
// lib/api.ts
export const apiFetch = async (path: string, init: RequestInit = {}) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL!; // e.g. http://127.0.0.1:8080/api/v1
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  };
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ code: 'UNKNOWN', message: res.statusText }));
    throw new Error(`${err.code}: ${err.message}`);
  }
  return res.json();
};
```

```ts
// 登录（wagmi/viem）
async function loginEvm(address: string) {
  const { nonce } = await apiFetch(`/auth/nonce?address=${address}`);
  const message = `Login to KMarket: nonce=${nonce}`;
  const signature = await signMessage({ message }); // wagmi
  const { token } = await apiFetch('/auth/verify-sig', { method: 'POST', body: JSON.stringify({ address, message, signature }) });
  localStorage.setItem('jwt', token);
}
```

```ts
// WS 客户端（简要）
const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}?token=${localStorage.getItem('jwt')}`);
ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', markets: ['1001'] }));
ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); /* handle seq/ts/payload */ };
```

---

## 验收标准

- 所有页面与表单均使用 `/api/v1/*` 与 `/ws/*`，能在本地成功联调。
- 弱网（50ms-500ms）情况下，WS 能自动重连并使用 REST 增量补全。
- 下注与领取流程可用；错误文案与边界情况（余额不足、市场未激活）有提示。
- 日志与观测：请求失败率、WS 连接状态可在前端可视化（或控制台）查看。

---

> 执行完以上 TODO 后，请在本文件标记完成项与相关 PR 链接；新增需求或接口变化，请追加“接口映射清单”与“环境变量”章节。