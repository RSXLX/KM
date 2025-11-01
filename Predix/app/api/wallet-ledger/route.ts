import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import mysql from 'mysql2/promise';

export const dynamic = 'force-dynamic';

function parseMysqlUrl(url: string) {
  const u = new URL(url);
  const database = u.pathname.replace(/^\//, '') || undefined;
  const ssl = u.searchParams.get('ssl');
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
    ssl: ssl === 'true' ? {} : undefined,
    connectionLimit: 5,
  } as any;
}

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

    // MySQL save-first approach
    let dbStatus: 'inserted' | 'skipped' | 'failed' = 'skipped';
    const mysqlUrl = process.env.MYSQL_URL;
    if (mysqlUrl) {
      try {
        const config = parseMysqlUrl(mysqlUrl);
        const pool = await mysql.createPool(config);

        await pool.query(
          `CREATE TABLE IF NOT EXISTS wallet_ledger (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            wallet VARCHAR(64) NOT NULL,
            signature VARCHAR(120) NOT NULL,
            network VARCHAR(16) NOT NULL DEFAULT 'devnet',
            rpc_url TEXT NOT NULL,
            direction ENUM('debit','credit') NOT NULL,
            delta_lamports BIGINT NOT NULL,
            delta_sol DECIMAL(20,9) NOT NULL,
            reason VARCHAR(24),
            fixture_id VARCHAR(64),
            status VARCHAR(16) DEFAULT 'confirmed',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            extra JSON,
            UNIQUE KEY unique_signature (signature)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        );

        const extraMerged = JSON.stringify({
          ...(typeof data.extra === 'object' && data.extra ? data.extra : {}),
          feeLamports,
          slot,
        });

        await pool.query(
          `INSERT INTO wallet_ledger 
           (wallet, signature, network, rpc_url, direction, delta_lamports, delta_sol, reason, fixture_id, status, extra)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE id = id`,
          [
            data.wallet,
            data.signature,
            data.network || 'devnet',
            rpcUrl,
            data.direction,
            data.deltaLamports,
            data.deltaSol,
            data.reason || null,
            data.fixtureId || null,
            'confirmed',
            extraMerged,
          ]
        );
        dbStatus = 'inserted';
      } catch (e) {
        dbStatus = 'failed';
        console.error('[wallet-ledger] MySQL write failed:', e);
      }
    }

    return NextResponse.json({ ok: true, dbStatus });
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

  // Try MySQL first; if unavailable or failing, fall back to on-chain scan
  const mysqlUrl = process.env.MYSQL_URL;

  if (mysqlUrl) {
    try {
      const config = parseMysqlUrl(mysqlUrl);
      const pool = await mysql.createPool(config);
      const [rows] = await pool.query(
        `SELECT wallet, signature, network, rpc_url, direction, delta_lamports, delta_sol, reason, fixture_id, status, created_at, extra
         FROM wallet_ledger WHERE wallet = ? ORDER BY id DESC LIMIT 50`,
        [wallet]
      );
      return NextResponse.json({ ok: true, wallet, items: rows });
    } catch (e) {
      console.error('[wallet-ledger] MySQL GET failed, falling back to chain:', e);
    }
  }

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