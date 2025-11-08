import { apiFetch } from '@/lib/api';

export type PlaceOrderBody = {
  marketId: number;
  option: number; // 1=home,2=away
  amountText: string; // decimal/lamports string
  oddsBps: number; // e.g. 185 -> 1.85
};

export type OrderResp = {
  orderId: number;
  userAddress: string;
  marketId: number;
  amount: string;
  odds: number;
  option: number;
  potentialPayout?: string | null;
  settled: boolean;
  claimed: boolean;
  txHash?: string | null;
};

export async function placeOrder(body: PlaceOrderBody) {
  return apiFetch<OrderResp>(`/bets`, {
    method: 'POST',
    body: JSON.stringify({
      marketId: body.marketId,
      option: body.option,
      amount: body.amountText,
      odds: body.oddsBps,
    }),
    ui: { showLoading: true, toastOnError: true, toastOnSuccess: true },
  });
}

export async function listOrders(params: { userAddress: string; marketId?: number; status?: string; page?: number; pageSize?: number }) {
  const qs = new URLSearchParams({
    userAddress: params.userAddress,
    ...(params.marketId ? { marketId: String(params.marketId) } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.page ? { page: String(params.page) } : {}),
    ...(params.pageSize ? { pageSize: String(params.pageSize) } : {}),
  }).toString();
  return apiFetch<{ page: number; pageSize: number; total: number; items: OrderResp[] }>(`/bets?${qs}`, {
    ui: { showLoading: true, toastOnError: true },
    timeoutMs: 8000,
  });
}

export async function getOrderById(orderId: number) {
  return apiFetch<OrderResp>(`/bets/${orderId}`, { ui: { showLoading: true, toastOnError: true } });
}

export async function claimOrder(orderId: number) {
  return apiFetch<{ ok: boolean }>(`/bets/${orderId}/claim`, { method: 'POST', ui: { showLoading: true, toastOnError: true, toastOnSuccess: true } });
}

// Adapters to legacy Position shape (minimal mapping)
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

function safeBigInt(text?: string | null): bigint {
  try { return BigInt(String(text ?? '0')); } catch { return 0n; }
}