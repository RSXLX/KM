import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// SPL Token Program ID (constant on Solana)
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export function getSolanaEndpoint(): string {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  const custom = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  return custom && custom.length > 0 ? custom : clusterApiUrl(network as any);
}

export function getConnection(commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed') {
  return new Connection(getSolanaEndpoint(), commitment);
}

export type MintBalance = {
  mint: string;
  amount: string; // base units as string (no decimals applied)
  decimals: number;
};

export async function getMintBalances(
  address: string,
  mints?: string[]
): Promise<MintBalance[]> {
  const owner = new PublicKey(address);
  const connection = getConnection('confirmed');
  const { value } = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
  const target = new Set((mints || []).filter(Boolean));

  const balances: MintBalance[] = [];
  for (const item of value) {
    const info: any = item.account.data.parsed?.info;
    const mint: string | undefined = info?.mint;
    const tokenAmount = info?.tokenAmount;
    if (!mint || !tokenAmount) continue;
    if (target.size > 0 && !target.has(mint)) continue;
    balances.push({ mint, amount: tokenAmount.amount, decimals: tokenAmount.decimals });
  }
  return balances;
}

export async function getMintBalance(address: string, mint: string): Promise<MintBalance | null> {
  const list = await getMintBalances(address, [mint]);
  return list[0] || null;
}