export type BackendMarketItem = {
  id: number;
  league: string;
  title: string;
  status: string;
  start_time?: number | null;
  odds?: any | null;
};

export type BackendMarketList = { page: number; pageSize: number; total: number; items: BackendMarketItem[] };

export type BackendOddsQuote = {
  marketId: number;
  odds_a?: number; // bps (legacy)
  odds_b?: number; // bps (legacy)
  moneyline?: { home: number; away: number } | null;
  spread?: { line: number; home: number; away: number } | null;
  total?: { line: number; over: number; under: number } | null;
  timestamp: number;
  source: string;
};

export type BackendActiveMarket = { market_id: number; title: string; category: string };
export type BackendActiveMarketsResp = { source: string; data: BackendActiveMarket[] };

export type BackendOrder = {
  orderId: number;
  userAddress: string;
  marketId: number;
  amount: string; // numeric string
  odds: number;   // bps
  option: number; // 1=home,2=away
  potentialPayout?: string | null;
  settled: boolean;
  claimed: boolean;
  txHash?: string | null;
};

export type BackendOrderList = { page: number; pageSize: number; total: number; items: BackendOrder[] };