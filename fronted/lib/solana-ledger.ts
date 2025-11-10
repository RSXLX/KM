import { Connection, PublicKey } from '@solana/web3.js';
import { getSolanaEndpoint } from '@/lib/solana';

export const LAMPORTS_PER_SOL = 1_000_000_000;

export type SendWithLedgerMeta = {
  reason?: 'bet' | 'payout' | 'transfer';
  fixtureId?: string;
  extra?: any;
};

export async function sendWithLedger(
  wallet: { publicKey: PublicKey; sendTransaction: (tx: any, conn: Connection) => Promise<string> },
  buildTx: () => Promise<any>,
  meta?: SendWithLedgerMeta
) {
  const endpoint = getSolanaEndpoint();
  const conn = new Connection(endpoint, 'confirmed');
  const addr = wallet.publicKey;

  const pre = await conn.getBalance(addr, 'confirmed');
  const tx = await buildTx();
  const signature = await wallet.sendTransaction(tx, conn);
  await conn.confirmTransaction(signature, 'confirmed');
  const post = await conn.getBalance(addr, 'confirmed');

  const deltaLamports = post - pre;
  const direction = deltaLamports < 0 ? 'debit' : 'credit';

  const { apiClient } = await import('@/lib/apiClient');
  try {
    await apiClient.post('/api/wallet-ledger', {
      wallet: addr.toBase58(),
      signature,
      network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
      rpcUrl: endpoint,
      direction,
      deltaLamports,
      deltaSol: Math.abs(deltaLamports) / LAMPORTS_PER_SOL,
      reason: meta?.reason || 'transfer',
      fixtureId: meta?.fixtureId,
      extra: meta?.extra,
      timestamp: new Date().toISOString(),
    }, { timeoutMs: 30000, dedup: false });
  } catch (e) {
    // 不阻断下注流程：后端/本地存储失败或网络超时仅记录警告
    //todo:  后期需修改为同步
    console.warn('[wallet-ledger] store failed (non-blocking):', (e as any)?.message || e);
  }

  return { signature, deltaLamports, direction };
}