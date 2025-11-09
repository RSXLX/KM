# 前端接口调用统一规范

## 目标
- 统一请求与错误处理、日志输出、超时与取消、避免重复请求。
- 简化与后端的交互，确保数据类型与格式一致。

## 客户端
- 文件：`lib/apiClient.ts`
- 特性：
  - 基础URL：从 `NEXT_PUBLIC_API_BASE_URL` 读取；支持绝对URL。
  - 日志：设置 `NEXT_PUBLIC_API_DEBUG=true` 输出请求/响应详细信息。
  - 超时：默认10s，可通过 `timeoutMs` 指定。
  - 取消：支持传入 `AbortSignal`；内部自动创建并在超时中断。
  - 去重：GET默认开启；可通过 `dedupKey` 或 `dedup=false` 控制。
  - 错误：HTTP非200抛出包含 `status/raw` 的Error。

### 使用示例
```ts
import apiClient from '@/lib/apiClient';

const markets = await apiClient.get('/compat/markets', {
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  query: { page: 1, limit: 20 },
  timeoutMs: 10000,
});

const res = await apiClient.post('/api/positions/close', {
  position_id: 123,
  wallet_address: '0x..',
}, { timeoutMs: 10000 });
```

## 调试输出要求
- 请求：URL/方法/请求头/参数与Body。
- 响应：状态码/响应头/原始数据与处理后数据。
- 错误：完整堆栈与原始响应内容（如有）。
- 开关：`NEXT_PUBLIC_API_DEBUG=true`。

## 模块改造
- `hooks/useMarkets.ts`：从兼容接口拉取；增加取消与异常处理。
- `hooks/useSportsBetting.ts`：加载mock fixtures使用apiClient。
- `components/sports/ClosePositionModal.tsx`：GET与POST改造为apiClient。
- `components/sports/MyBet.tsx`：GET改造为apiClient并添加调试输出。
- `app/account/positions/page.tsx`：GET与POST改造为apiClient。
- `app/database-status/page.tsx`：GET/POST改造为apiClient。
- `components/sports/LiveInPlayGrid.tsx`：实时数据GET改造为apiClient并保留取消。
- `lib/solana-ledger.ts`：账本写入改造为apiClient。
- `lib/event-listener.ts` 与 `app/api/events/history/route.ts`：内部重试与事件处理调用统一apiClient。

## 测试
- 脚本：`scripts/test-api.js`
  - 验证 `compat/markets` 与 `database/health` 的成功/失败场景。
- 建议：在浏览器开发者工具中观察Console与Network，确认无重复请求、取消生效、错误日志完整。

## 性能与稳定
- 去重：GET请求默认去重，避免连续点击造成重复加载。
- 取消：在组件卸载或参数变化时通过 `AbortController` 取消，避免内存泄漏。
- 超时：统一超时中断，减少长时间挂起。

## 注意事项
- 对POST/PUT请求，Body需为JSON并匹配后端字段要求。
- Authorization：如需鉴权可设置 `NEXT_PUBLIC_API_TOKEN`，客户端自动附带 `Bearer`。
- 统一数据类型：兼容接口返回数字类型字段，避免字符串数字导致的类型不一致。