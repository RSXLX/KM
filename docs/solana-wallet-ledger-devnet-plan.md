# Solana Devnet 钱包增减交互与数据库记录方案（分步实施 + WSL）

目标
- 切换到 Devnet，使用 Helius RPC：`https://devnet.helius-rpc.com/?api-key=fea87872-8801-4ff8-b8db-08138d2d5bed`
- 仅记录钱包的增减交互（Debit/Credit）并落库（不依赖特定合约）
- 前端以余额差值为准计算增减，后端接收并入库

总体思路
- 所有发送交易统一封装：发送前后读取余额 → 计算差额 → 上报接口 → 写数据库

步骤 0（WSL）：配置 WSL 环境
- 在 Windows 开启 WSL2（PowerShell）：
  - `wsl --install`（首次安装）
  - `wsl -l -v` 查看发行版，确保为 WSL2；否则执行：`wsl --set-version Ubuntu 2`
- 在 WSL（建议 Ubuntu）安装基础依赖：
  - `sudo apt update && sudo apt upgrade -y`
  - `sudo apt install -y build-essential curl git pkg-config libssl-dev ca-certificates jq net-tools`
- 安装 Node.js 18（推荐 nvm）：
  - `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`
  - `source ~/.nvm/nvm.sh && nvm install 18 && nvm use 18`
- 安装包管理器（pnpm）：
  - `corepack enable && corepack prepare pnpm@9 --activate`（或 `npm i -g pnpm`）
- 可选：安装 Solana CLI（用于调试与网络校验）：
  - `sh -c "$(curl -sSfL https://release.solana.com/v1.18.12/install)"`
  - `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"`
  - 设置 Devnet：`solana config set --url https://devnet.helius-rpc.com/?api-key=fea87872-8801-4ff8-b8db-08138d2d5bed`
- 校验 Helius RPC 可达性（WSL 内）：
  - `curl -s https://devnet.helius-rpc.com/?api-key=fea87872-8801-4ff8-b8db-08138d2d5bed -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash"}'`
  - 返回包含 `result` 即可用；若证书错误，确保安装 `ca-certificates` 并重试。
- 进入项目目录（WSL 路径）：
  - `cd /mnt/c/Users/94447/Desktop/Learn/Ibet/Predix`
  - `pnpm install`
  - 启动开发：`pnpm dev`（如需从 Windows 浏览器访问 WSL 服务，使用 `next dev -H 0.0.0.0 -p 3000`）
- Windows 浏览器访问：`http://localhost:3000/`（若不通检查 Windows 防火墙）
- 数据库连接（PostgreSQL 在 Windows）：
  - `.env` 中 `DATABASE_URL` 使用 `localhost`/`127.0.0.1` 通常可用；不通时改为 Windows 本机局域网 IP。
- 文件监听与网络注意：
  - 若 Next.js 热更新不灵，可设 `CHOKIDAR_USEPOLLING=1`
  - WSL 与 Windows 共享端口，建议绑定 `0.0.0.0` 以提升访问兼容性
- 参考：更完整的 Anchor+WSL 配置见 `docs/helius-anchor-wsl/`

步骤 1：配置 Devnet 与 Helius RPC（前端）
- 在 `Predix/.env.local` 添加：
  - `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
  - `NEXT_PUBLIC_SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=fea87872-8801-4ff8-b8db-08138d2d5bed`
- 说明：`WalletProvider.tsx` 与 `lib/solana.ts` 会优先读取 `NEXT_PUBLIC_SOLANA_RPC_URL`，否则回落到 `clusterApiUrl(NETWORK)`。

步骤 2：验证 RPC 与钱包网络
- 在控制台打印 `getSolanaEndpoint()` 的返回值，应为 Helius 地址。
- 钱包网络显示 Devnet，余额查询：`connection.getBalance(publicKey)` 正常返回。

步骤 3：设计数据库表（PostgreSQL）
```sql
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id BIGSERIAL PRIMARY KEY,
  wallet VARCHAR(64) NOT NULL,
  signature VARCHAR(120) NOT NULL UNIQUE,
  network VARCHAR(16) NOT NULL DEFAULT 'devnet',
  rpc_url TEXT NOT NULL,
  direction VARCHAR(8) NOT NULL CHECK (direction IN ('debit','credit')),
  delta_lamports BIGINT NOT NULL,
  delta_sol NUMERIC(20,9) NOT NULL,
  reason VARCHAR(24),
  fixture_id VARCHAR(64),
  status VARCHAR(16) DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extra JSONB
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet_time ON wallet_ledger(wallet, created_at DESC);
```
- 环境变量：`DATABASE_URL=postgresql://user:pass@host:port/dbname`

步骤 4：后端 API 约定（App Router 或 Netlify Functions）
- 路径：`POST /api/wallet-ledger`
- 请求体：
```json
{
  "wallet": "<base58>",
  "signature": "<tx signature>",
  "network": "devnet",
  "rpcUrl": "https://devnet.helius-rpc.com/?api-key=...",
  "direction": "debit|credit",
  "deltaLamports": -12345,
  "deltaSol": 0.000012345,
  "reason": "bet|payout|transfer",
  "fixtureId": "<optional>",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

步骤 5：后端实现（伪代码）
```ts
// app/api/wallet-ledger/route.ts
import { NextResponse } from 'next/server'
import { Connection } from '@solana/web3.js'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function POST(req: Request) {
  const data = await req.json()
  if (!data.wallet || !data.signature || !data.direction) {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })
  }

  // 可选：RPC 校验签名存在（幂等和可信度）
  try {
    const conn = new Connection(data.rpcUrl, 'confirmed')
    const tx = await conn.getTransaction(data.signature, { maxSupportedTransactionVersion: 0 })
    if (!tx) return NextResponse.json({ ok: false, error: 'TX_NOT_FOUND' }, { status: 400 })
  } catch {}

  await pool.query(
    `INSERT INTO wallet_ledger 
     (wallet, signature, network, rpc_url, direction, delta_lamports, delta_sol, reason, fixture_id, status, extra)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (signature) DO NOTHING`,
    [
      data.wallet,
      data.signature,
      data.network || 'devnet',
      data.rpcUrl,
      data.direction,
      data.deltaLamports,
      data.deltaSol,
      data.reason || null,
      data.fixtureId || null,
      'confirmed',
      data.extra || null,
    ]
  )

  return NextResponse.json({ ok: true })
}
```

步骤 6：前端封装统一发送（余额差值）
```ts
import { Connection, PublicKey } from '@solana/web3.js'
import { getSolanaEndpoint } from '@/lib/solana'

export const LAMPORTS_PER_SOL = 1_000_000_000

export async function sendWithLedger(
  wallet: { publicKey: PublicKey; sendTransaction: Function },
  buildTx: () => Promise<any>,
  meta?: { reason?: 'bet' | 'payout' | 'transfer'; fixtureId?: string }
) {
  const endpoint = getSolanaEndpoint()
  const conn = new Connection(endpoint, 'confirmed')
  const addr = wallet.publicKey

  const pre = await conn.getBalance(addr, 'confirmed')
  const tx = await buildTx()
  const sig = await wallet.sendTransaction(tx, conn)
  await conn.confirmTransaction(sig, 'confirmed')
  const post = await conn.getBalance(addr, 'confirmed')

  const deltaLamports = post - pre
  const direction = deltaLamports < 0 ? 'debit' : 'credit'

  await fetch('/api/wallet-ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: addr.toBase58(),
      signature: sig,
      network: 'devnet',
      rpcUrl: endpoint,
      direction,
      deltaLamports,
      deltaSol: Math.abs(deltaLamports) / LAMPORTS_PER_SOL,
      reason: meta?.reason || 'transfer',
      fixtureId: meta?.fixtureId,
      timestamp: new Date().toISOString(),
    })
  })

  return { signature: sig, deltaLamports, direction }
}
```

步骤 7：测试交易构造（最小验证）
```ts
import { SystemProgram, Transaction, PublicKey } from '@solana/web3.js'

function buildTestTx(walletPk: PublicKey, to: string, sol: number) {
  const lamports = Math.round(sol * 1_000_000_000)
  const ix = SystemProgram.transfer({ fromPubkey: walletPk, toPubkey: new PublicKey(to), lamports })
  const tx = new Transaction().add(ix)
  return tx
}

// 用法：sendWithLedger(wallet, () => Promise.resolve(buildTestTx(wallet.publicKey, '<test-to>', 0.001)), { reason: 'transfer' })
```

步骤 8：集成到 UI（可选但推荐）
- 在下注按钮的事件处理中，改用 `sendWithLedger()` 包装交易发送（或当前的模拟交易）。
- `meta.reason` 根据业务传 `bet`/`payout`，`fixtureId` 传赛事 ID，便于查询。

步骤 9：验证与监控
- Explorer 查看签名：`https://explorer.solana.com/tx/<sig>?cluster=devnet`
- 查库应出现一条 `debit` 或 `credit` 的记录，`signature` 唯一。
- 失败重试：由于 `signature` 唯一键，重复上报不会重复入库。

注意事项
- 余额差值会包含网络手续费与租金变化，用于记账足够；如需精确可读取 `getTransaction().meta.preBalances/postBalances`。
- 服务端最好校验交易存在性，必要时解析账户列表确保签名与钱包匹配。
- 大量并发可引入队列或批量写入，避免数据库压力。

扩展（后续可选）
- 事件分类：解析交易日志精细区分 `bet/payout`。
- 实时订阅：基于 `onAccountChange` 做钱包余额变化监听，作为补充通道。
- 报表：按 `fixtureId/wallet/direction` 统计，支持导出。