import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

// MySQL implementation removed. On-chain verify only; storage delegated to backend service.

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.wallet || !data.signature || !data.direction) {
      return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 });
    }

    const rpcUrl =
      data.rpcUrl || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

    // Optional: verify transaction exists on-chain for added credibility
    let feeLamports: number | null = null;
    let slot: number | null = null;
    try {
      const conn = new Connection(rpcUrl, 'confirmed');
      const tx = await conn.getTransaction(data.signature, { maxSupportedTransactionVersion: 0 });
      if (!tx) {
        console.warn('[wallet-ledger] transaction not found for signature:', data.signature);
      } else {
        feeLamports = tx.meta?.fee ?? null;
        slot = (tx as any)?.slot ?? null;
      }
    } catch (e) {
      console.warn('[wallet-ledger] rpc verify failed:', (e as any)?.message || e);
    }

    // Storage moved to backend. Here we only acknowledge.
    const dbStatus: 'stored_by_backend' | 'not_stored' = 'not_stored';
    return NextResponse.json({ ok: true, dbStatus, feeLamports, slot });
  } catch (e) {
    console.error('[wallet-ledger] error:', e);
    return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({ ok: false, error: 'MISSING_WALLET' }, { status: 400 });
  }

  // MySQL has been removed; read directly from chain.

  try {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const conn = new Connection(rpcUrl, 'confirmed');
    const addr = new PublicKey(wallet);
    const signatures = await conn.getSignaturesForAddress(addr, { limit: 15 });

    const items: any[] = [];
    for (const s of signatures) {
      const tx = await conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
      if (!tx) continue;

      const keys = (tx.transaction.message.accountKeys as any[]).map((k: any) =>
        typeof k?.toBase58 === 'function' ? k.toBase58() : String(k)
      );
      const idx = keys.indexOf(wallet);
      if (idx < 0) continue;

      const pre = tx.meta?.preBalances?.[idx];
      const post = tx.meta?.postBalances?.[idx];
      if (typeof pre !== 'number' || typeof post !== 'number') continue;

      const deltaLamports = post - pre;
      const direction = deltaLamports < 0 ? 'debit' : 'credit';
      const deltaSol = Math.abs(deltaLamports) / 1_000_000_000;

      const createdAt =
        (tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : new Date().toISOString());

      items.push({
        wallet,
        signature: s.signature,
        network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
        rpc_url: rpcUrl,
        direction,
        delta_lamports: deltaLamports,
        delta_sol: deltaSol,
        reason: null,
        fixture_id: null,
        status: 'confirmed',
        created_at: createdAt,
        extra: { feeLamports: tx.meta?.fee ?? null, slot: (tx as any)?.slot ?? null },
      });
    }

    return NextResponse.json({ ok: true, wallet, items });
  } catch (e) {
    console.error('[wallet-ledger] Chain fallback error:', e);
    return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }
}