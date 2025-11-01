# Solana Devnet 投注金额与钱包交互开发文档

目标
- 将投注金额与已登录钱包交互，使用 Devnet 网络完成交易
- 将前端金额换算为 SOL 的最小单位 lamports 并提交
- 通过 Anchor 程序 `levr_bet` 的 `place_bet` 指令记录下注与资金托管

前置条件
- Node.js 18+ 与本项目依赖已安装：`npm install`
- 浏览器安装 Phantom 或 Solflare，并切换到 Devnet
- Devnet 余额充足（可用 Faucet 或 `solana airdrop`）

环境变量（.env.local）
- `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
- 可选自定义 RPC：`NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com`
- 程序 ID（来自 Anchor 程序）：`NEXT_PUBLIC_LEVR_BET_PROGRAM_ID=Fsrb3f4B6kGa9zJXvvBqwRNhGSrQMNeLMcfge8WiGHVu`

现有钱包集成
- 已集成 `@solana/wallet-adapter-react`，并在 `WalletProvider.tsx` 默认使用 Devnet 与 Phantom/Solflare。
- 页面布局已在 `app/layout.tsx` 引入钱包 UI 样式：`@solana/wallet-adapter-react-ui/styles.css`。

单位换算与赔率基点
- 货币单位：`1 SOL = 1_000_000_000 lamports`
- Anchor 程序倍率/赔率单位：`SCALE_BPS = 10_000`（1x=10_000bp，2x=20_000bp）
- 前端换算示例：

```ts
export const LAMPORTS_PER_SOL = 1_000_000_000;
export function toLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}
export function toBps(multiplier: number): number {
  return Math.round(multiplier * 10_000); // 2x => 20_000
}
```

安装与生成 IDL（仅限需要调用 Anchor 指令场景）
- 安装 Anchor JS 客户端：`npm i @coral-xyz/anchor`
- 进入 Anchor 项目并构建：
  - `cd anchor/levr-bet`
  - `anchor build`
- 复制生成的 IDL 到前端（建议位置）：`Predix/lib/idl/levr_bet.json`
- 如程序 ID 更新：`declare_id!` 将由 CI/`anchor keys sync`维护，前端取 `.env` 配置。

账户派生（PDA）
- `config`：`seeds = [b"config"]`
- `market`：`seeds = [b"market", market_id_seed]`，其中 `market_id_seed` 为 32 字节
- `escrow`：`seeds = [b"escrow", market.key(), b"SOL"]`（SystemAccount 托管 SOL）
- `bet`：`seeds = [b"bet", user.key(), market.key(), nonce_le_bytes]`

市场种子计算示例
```ts
import { createHash } from 'crypto';
export function deriveMarketSeed(fixtureId: string): Buffer {
  const digest = createHash('sha256').update(fixtureId).digest();
  return digest.subarray(0, 32); // 32 字节
}
```

前端集成：调用 `place_bet` 指令
- 使用 Anchor Provider + Program 调用（推荐）。
- 示例函数（可放置到 `Predix/lib/solana-bet.ts`，并在组件中调用）：

```ts
import { PublicKey, SystemProgram, Connection } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import idl from '@/lib/idl/levr_bet.json';
import { getSolanaEndpoint } from '@/lib/solana';
import { toLamports, toBps } from '@/lib/utils'; // 或使用本文上方函数
import { deriveMarketSeed } from '@/lib/marketSeed';

export async function placeBetSol(
  walletAdapter: any, // 来自 useWallet()
  fixtureId: string,
  selectedTeam: 1 | 2,
  amountSol: number,
  multiplier: number,
) {
  if (!walletAdapter?.publicKey) throw new Error('Wallet not connected');
  const connection = new Connection(getSolanaEndpoint(), 'confirmed');
  const programId = new PublicKey(process.env.NEXT_PUBLIC_LEVR_BET_PROGRAM_ID!);

  const provider = new AnchorProvider(connection, walletAdapter as any, { preflightCommitment: 'confirmed' });
  const program = new Program(idl as any, programId, provider);

  // 派生 PDA
  const configPda = PublicKey.findProgramAddressSync([Buffer.from('config')], programId)[0];
  const marketSeed = deriveMarketSeed(fixtureId);
  const marketPda = PublicKey.findProgramAddressSync([Buffer.from('market'), marketSeed], programId)[0];
  const escrowPda = PublicKey.findProgramAddressSync([Buffer.from('escrow'), marketPda.toBuffer(), Buffer.from('SOL')], programId)[0];

  const nonce = Date.now();
  const nonceLe = Buffer.alloc(8); // u64 LE
  nonceLe.writeBigUInt64LE(BigInt(nonce));
  const betPda = PublicKey.findProgramAddressSync([
    Buffer.from('bet'),
    walletAdapter.publicKey.toBuffer(),
    marketPda.toBuffer(),
    nonceLe,
  ], programId)[0];

  // 金额与倍率换算
  const amountLamports = toLamports(amountSol);
  const multiplierBps = toBps(multiplier);

  // 组装与发送交易
  const sig = await program.methods.placeBet({
    selectedTeam,
    amount: new BN(amountLamports),
    multiplierBps,
    nonce: new BN(nonce),
  }).accounts({
    user: walletAdapter.publicKey,
    config: configPda,
    market: marketPda,
    escrow: escrowPda,
    bet: betPda,
    systemProgram: SystemProgram.programId,
  }).rpc();

  return {
    signature: sig,
    explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
    betPda: betPda.toBase58(),
  };
}
```

组件调用示例（以 `BetPanel` / `BetModal` 为例）
```ts
import { useWallet } from '@solana/wallet-adapter-react';
import { placeBetSol } from '@/lib/solana-bet';

// 在下单按钮回调中：
const { publicKey, signTransaction, sendTransaction } = useWallet();

async function onPlaceBet() {
  const selectedTeam = selectedTeamState === 'home' ? 1 : 2;
  const amountSol = Number(amountInput); // UI 输入按 SOL 记价
  const multiplier = Number(multiplierInput); // 例如 2,3,4,5
  const res = await placeBetSol({ publicKey, signTransaction, sendTransaction }, fixtureId, selectedTeam, amountSol, multiplier);
  console.log('Bet submitted:', res);
}
```

功能验证
- Airdrop 资产：
  - 终端：`solana airdrop 2 <YourWalletAddress> --url https://api.devnet.solana.com`
  - 或 Phantom Devnet Faucet
- 余额检查：`connection.getBalance(publicKey)`；确保大于网络费
- 成功提交后：在 Explorer 打开返回的链接查看交易与账户
- 读取下注账户：

```ts
const bet = await program.account.betAccount.fetch(new PublicKey(betPda));
console.log(bet);
```

注意事项
- 手续费与最小金额：请参考 `ConfigAccount.min_bet` 与网络费，避免金额过小
- 倍率与赔率：均以基点存储（`SCALE_BPS=10_000`），输入需转换
- 风险敞口：程序会校验 `market.max_exposure`，可能导致下单失败
- Devnet 环境不稳定，建议使用自定义 RPC 提高稳定性

备用方案（仅验证钱包交互）
- 若暂未生成 IDL，可先向自己的测试地址转账验证交互：

```ts
import { SystemProgram, Transaction, PublicKey } from '@solana/web3.js';
const ix = SystemProgram.transfer({ fromPubkey: wallet.publicKey!, toPubkey: new PublicKey('<test-address>'), lamports: toLamports(0.01) });
const tx = new Transaction().add(ix);
const sig = await sendTransaction(tx, connection);
```

至此，前端即可将投注金额转换为 SOL 并在 Devnet 与已登录钱包完成交互，调用 Anchor 程序记录下注。