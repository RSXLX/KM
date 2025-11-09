// 数据库模型的 TypeScript 类型定义

export interface User {
  id: number;
  wallet_address: string;
  username?: string;
  email?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Market {
  id: number;
  market_id_seed: Buffer;
  market_address: string;
  home_code: number;
  away_code: number;
  home_name?: string;
  away_name?: string;
  start_time: Date;
  close_time: Date;
  state: MarketState;
  result: number; // 0=None, 1=Home, 2=Away
  odds_home_bps: number;
  odds_away_bps: number;
  max_exposure: number;
  current_exposure: number;
  total_volume: number;
  total_bets: number;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
}

export interface Position {
  id: number;
  user_id: number;
  market_id: number;
  wallet_address: string;
  market_address: string;
  bet_address?: string;
  nonce: number;
  
  // 交易基本信息
  position_type: 'OPEN' | 'CLOSE';
  selected_team: number; // 1=Home, 2=Away
  amount: number; // lamports
  multiplier_bps: number;
  
  // 赔率信息
  odds_home_bps?: number;
  odds_away_bps?: number;
  payout_expected?: number;
  
  // 交易状态
  status: PositionStatus;
  is_claimed: boolean;
  
  // 盈亏信息
  pnl: number;
  fee_paid: number;
  close_price?: number;
  close_pnl?: number;
  
  // 时间戳
  timestamp: Date;
  created_at: Date;
  updated_at: Date;
  closed_at?: Date;
  
  // 链上信息
  transaction_signature?: string;
  block_slot?: number;
  confirmation_status: 'pending' | 'confirmed' | 'finalized';
}

export interface BlockchainEvent {
  id: number;
  event_type: 'BetPlaced' | 'BetClaimed' | 'MarketResolved' | 'BetClosed';
  transaction_signature: string;
  block_slot: number;
  block_time?: Date;
  
  // 事件相关地址
  user_address?: string;
  market_address?: string;
  bet_address?: string;
  
  // 事件数据
  event_data: any; // JSON data
  
  // 处理状态
  processed: boolean;
  processed_at?: Date;
  error_message?: string;
  
  created_at: Date;
}

export interface UserStats {
  id: number;
  user_id: number;
  wallet_address: string;
  
  // 交易统计
  total_positions: number;
  open_positions: number;
  closed_positions: number;
  won_positions: number;
  lost_positions: number;
  
  // 资金统计
  total_volume: number;
  total_pnl: number;
  total_fees_paid: number;
  max_position_size: number;
  
  // 胜率统计
  win_rate: number; // 0-1
  avg_hold_time?: string; // PostgreSQL interval
  
  // 时间戳
  first_trade_at?: Date;
  last_trade_at?: Date;
  updated_at: Date;
}

export interface MarketStats {
  id: number;
  market_id: number;
  market_address: string;
  
  // 交易统计
  total_positions: number;
  home_positions: number;
  away_positions: number;
  
  // 资金统计
  total_volume: number;
  home_volume: number;
  away_volume: number;
  
  // 赔率变化
  initial_odds_home_bps: number;
  initial_odds_away_bps: number;
  current_odds_home_bps: number;
  current_odds_away_bps: number;
  
  updated_at: Date;
}

// 枚举类型
export enum MarketState {
  Open = 1,
  Closed = 2,
  Resolved = 3,
  Canceled = 4
}

export enum PositionStatus {
  Placed = 1,
  SettledWin = 2,
  SettledLose = 3,
  Canceled = 4,
  Refunded = 5,
  ClosedEarly = 6 // 新增：提前平仓状态
}

// API 请求/响应类型
export interface CreatePositionRequest {
  wallet_address: string;
  market_address: string;
  selected_team: number;
  amount: number;
  multiplier_bps: number;
  transaction_signature: string;
}

export interface ClosePositionRequest {
  position_id: number;
  wallet_address: string;
  close_price?: number;
  transaction_signature: string;
}

export interface PositionResponse extends Position {
  user?: User;
  market?: Market;
}

export interface UserPositionsResponse {
  positions: PositionResponse[];
  stats: UserStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface MarketPositionsResponse {
  positions: PositionResponse[];
  market: Market;
  stats: MarketStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// 查询参数类型
export interface PositionQueryParams {
  wallet_address?: string;
  market_address?: string;
  status?: PositionStatus;
  position_type?: 'OPEN' | 'CLOSE';
  selected_team?: number;
  from_date?: Date;
  to_date?: Date;
  page?: number;
  limit?: number;
  sort_by?: 'timestamp' | 'amount' | 'pnl';
  sort_order?: 'asc' | 'desc';
}

// 链上事件处理类型
export interface EventBetPlaced {
  user: string;
  market: string;
  team: number;
  amount: number;
  odds_bps: number;
  multiplier_bps: number;
}

export interface EventBetClaimed {
  user: string;
  market: string;
  payout: number;
  pnl: number;
}

export interface EventMarketResolved {
  market: string;
  result: number;
}

export interface EventBetClosed {
  user: string;
  market: string;
  bet: string;
  close_price: number;
  pnl: number;
}

// 数据库连接配置
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
    idle_timeout: number;
  };
}

// 同步状态类型
export interface SyncStatus {
  last_processed_slot: number;
  last_sync_time: Date;
  pending_events: number;
  failed_events: number;
  sync_lag_seconds: number;
}