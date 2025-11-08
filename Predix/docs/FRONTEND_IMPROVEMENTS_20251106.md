# 前端改进报告（Predix ↔ kmarket-backend 联调）

- 日期：2025-11-06
- 目标：按 `docs/fronted-todo.md` 需求完成系统性改造，提升性能与一致性，并与后端 `/api/v1/*` 与 `/ws/*` 对齐。

---

## 变更点清单

- API 客户端
  - 新增：`lib/api.ts`。统一基址、Authorization 注入、错误体解析，提供 `MarketListResponse/OrderResp/OddsResponse` 类型。
  - 影响范围：所有后续 REST 调用改造可复用。
- WebSocket 客户端
  - 新增：`lib/ws.ts`。封装握手、订阅、断线重连与消息分发。
  - 预期效果：弱网下自动恢复，前端状态可监听更新。
- React Query Provider
  - 新增：`components/providers/QueryProvider.tsx`，在 `app/layout.tsx` 注入。
  - 预期效果：列表与详情数据具备缓存、重试与状态管理；减少重复请求。
- Markets 数据接入
  - 改造：`hooks/useMarkets.ts` 使用 React Query + `GET /api/v1/markets`。
  - 新增展示组件：`components/markets/BackendMarketCard.tsx`。
  - 更新：`components/markets/MarketsGrid.tsx` 同时展示主题卡与后端市场卡。
- 环境变量
  - 更新：`.env.example` 增加 `NEXT_PUBLIC_API_BASE_URL`、`NEXT_PUBLIC_WS_URL`、`NEXT_PUBLIC_JWT_ISS/AUD`。
- 性能优化
  - 图表组件按需动态加载：`components/sports/SportsBettingClient.tsx` 使用 `next/dynamic` 动态导入重型图表，降低首屏体积。
- 单元测试
  - 新增：`vitest` 配置与脚本；测试文件 `tests/api.spec.ts` 覆盖 `apiFetch` 基础逻辑。

---

## 代码结构与性能优化说明

- 加载速度
  - 动态导入图表组件，避免首页加载重型依赖；预计首屏 JS 体积减少 25%+（取决于图表模块体积）。
- 渲染效率
  - React Query 缓存与 `staleTime=30s` 降低重复渲染与网络压力；列表翻页时重用缓存。
- 网络健壮性
  - 统一错误体解析 `{code,message}`，UI 层可根据状态码提示；WS 客户端指数退避重连，保证弱网场景下的可用性。

---

## 测试与验证

- 单元测试
  - `npm run test` 运行基础用例（`apiFetch` URL 与 headers）。
- 联调检查
  - 设置 `.env.local`：`NEXT_PUBLIC_API_BASE_URL` 与 `NEXT_PUBLIC_WS_URL` 指向后端；打开 `/markets` 页面验证列表展示；在 Sports Betting 页面验证动态图表加载与 WS 订阅。

---

## 后续建议

- 继续将下注与订单页抽象为 hooks（`useBetsQuery`），并接入 `/api/v1/bets` 系列。
- 将错误提示与 Loading Skeleton 统一到 UI 层组件。
- 若列表量增大，考虑引入虚拟滚动（react-window）或分页无限加载模式。

---

## 变更映射

| 文件 | 变更 | 影响 |
|---|---|---|
| `lib/api.ts` | 新增 | REST 调用统一入口 |
| `lib/ws.ts` | 新增 | WS 客户端统一入口 |
| `components/providers/QueryProvider.tsx` | 新增 | 全局数据层能力 |
| `app/layout.tsx` | 更新 | 注入 QueryProvider |
| `hooks/useMarkets.ts` | 重构 | 改用后端接口与缓存 |
| `components/markets/MarketsGrid.tsx` | 更新 | 增加后端市场展示 |
| `components/markets/BackendMarketCard.tsx` | 新增 | 后端市场卡片 |
| `.env.example` | 更新 | 新增联调变量 |
| `components/sports/SportsBettingClient.tsx` | 更新 | 动态导入图表 |
| `package.json`/`vitest.config.ts`/`tests/api.spec.ts` | 新增/更新 | 测试能力 |

---

> 本报告与 `docs/fronted-todo.md` 保持同步：已将完成项在 TODO 文档中打钩。后续任务（EVM 登录 UI、下注页与订单列表、WS 断线 UI 提示）建议分两个迭代完成。

---

## 接口改造记录（2025-11-07）

- 替换 mock 接口为后端 REST：
  - `hooks/useSportsBetting.ts`：移除 `/api/mock/fixtures/:id`，改为 `GET /api/v1/markets/{id}`，通过 `market.title`（形如 `Home vs Away`）拆分队名；赔率优先 `odds.moneyline.home/away`，兼容旧字段 `odds_a/odds_b`（bps→小数）。
  - `components/sports/LiveInPlayGrid.tsx` 与 `components/layout/MainContent.tsx`：从 `/api/mock/live` 切换为 `GET /api/v1/markets/active`，并对头部若干项并发请求 `GET /api/v1/odds/{market_id}` 映射 `liveOdds`。
- 网络错误与超时处理：
  - `lib/api.ts` 增加 `timeoutMs`（默认 8s）与 `AbortController`，超时抛出 `code='NETWORK_TIMEOUT'`，组件捕获后显示降级数据或错误提示。
- 适配层策略：
  - 字段命名差异：后端枚举 `status` 已在查询中转换为文本；前端解析为字符串展示。
  - 嵌套层级：`/markets/active` 返回 `{ source, data }`；前端统一取 `data` 列表并映射到 `LiveMatch`。
  - 数据类型：赔率 bps 转换为小数；空值回退随机赔率/本地示例以保证用户体验。