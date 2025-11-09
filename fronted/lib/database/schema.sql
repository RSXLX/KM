-- 数据库模式设计：开仓和平仓记录系统
-- 支持链上和链下数据同步

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) UNIQUE NOT NULL, -- Solana 钱包地址
    username VARCHAR(50),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 市场表
CREATE TABLE IF NOT EXISTS markets (
    id SERIAL PRIMARY KEY,
    market_id_seed BYTEA NOT NULL, -- 对应智能合约的 market_id_seed
    market_address VARCHAR(44) UNIQUE NOT NULL, -- 市场 PDA 地址
    home_code BIGINT NOT NULL,
    away_code BIGINT NOT NULL,
    home_name VARCHAR(100),
    away_name VARCHAR(100),
    start_time TIMESTAMP NOT NULL,
    close_time TIMESTAMP NOT NULL,
    state INTEGER NOT NULL DEFAULT 1, -- 1=Open, 2=Closed, 3=Resolved, 4=Canceled
    result INTEGER DEFAULT 0, -- 0=None, 1=Home, 2=Away
    odds_home_bps INTEGER NOT NULL,
    odds_away_bps INTEGER NOT NULL,
    max_exposure BIGINT NOT NULL,
    current_exposure BIGINT DEFAULT 0,
    total_volume BIGINT DEFAULT 0, -- 总交易量
    total_bets INTEGER DEFAULT 0, -- 总下注数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL
);

-- 交易记录表（开仓和平仓的统一记录）
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    market_id INTEGER REFERENCES markets(id),
    wallet_address VARCHAR(44) NOT NULL,
    market_address VARCHAR(44) NOT NULL,
    bet_address VARCHAR(44) UNIQUE, -- BetAccount PDA 地址
    nonce BIGINT NOT NULL,
    
    -- 交易基本信息
    position_type VARCHAR(10) NOT NULL, -- 'OPEN' 或 'CLOSE'
    selected_team INTEGER NOT NULL, -- 1=Home, 2=Away
    amount BIGINT NOT NULL, -- 下注金额（lamports）
    multiplier_bps INTEGER NOT NULL, -- 杠杆倍数（基点）
    
    -- 赔率信息（开仓时记录）
    odds_home_bps INTEGER,
    odds_away_bps INTEGER,
    payout_expected BIGINT, -- 预期收益
    
    -- 交易状态
    status INTEGER NOT NULL DEFAULT 1, -- 1=Placed, 2=SettledWin, 3=SettledLose, 4=Canceled, 5=Refunded, 6=ClosedEarly
    is_claimed BOOLEAN DEFAULT FALSE,
    
    -- 盈亏信息
    pnl BIGINT DEFAULT 0, -- 实际盈亏（lamports）
    fee_paid BIGINT DEFAULT 0, -- 支付的手续费
    close_price BIGINT NULL, -- 平仓价格（如果提前平仓）
    close_pnl BIGINT NULL, -- 平仓盈亏
    
    -- 时间戳
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    
    -- 链上信息
    transaction_signature VARCHAR(88), -- 交易签名
    block_slot BIGINT, -- 区块槽位
    confirmation_status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, finalized
    
    -- 索引约束
    UNIQUE(wallet_address, market_address, nonce)
);

-- 链上事件日志表
CREATE TABLE IF NOT EXISTS blockchain_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- BetPlaced, BetClaimed, MarketResolved, BetClosed
    transaction_signature VARCHAR(88) NOT NULL,
    block_slot BIGINT NOT NULL,
    block_time TIMESTAMP,
    
    -- 事件相关地址
    user_address VARCHAR(44),
    market_address VARCHAR(44),
    bet_address VARCHAR(44),
    
    -- 事件数据（JSON格式存储原始事件数据）
    event_data JSONB NOT NULL,
    
    -- 处理状态
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP NULL,
    error_message TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    UNIQUE(transaction_signature, event_type)
);

-- 用户统计表
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    
    -- 交易统计
    total_positions INTEGER DEFAULT 0,
    open_positions INTEGER DEFAULT 0,
    closed_positions INTEGER DEFAULT 0,
    won_positions INTEGER DEFAULT 0,
    lost_positions INTEGER DEFAULT 0,
    
    -- 资金统计
    total_volume BIGINT DEFAULT 0, -- 总交易量
    total_pnl BIGINT DEFAULT 0, -- 总盈亏
    total_fees_paid BIGINT DEFAULT 0, -- 总手续费
    max_position_size BIGINT DEFAULT 0, -- 最大单笔交易
    
    -- 胜率统计
    win_rate DECIMAL(5,4) DEFAULT 0, -- 胜率（0-1）
    avg_hold_time INTERVAL, -- 平均持仓时间
    
    -- 时间戳
    first_trade_at TIMESTAMP,
    last_trade_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 市场统计表
CREATE TABLE IF NOT EXISTS market_stats (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) UNIQUE,
    market_address VARCHAR(44) UNIQUE NOT NULL,
    
    -- 交易统计
    total_positions INTEGER DEFAULT 0,
    home_positions INTEGER DEFAULT 0,
    away_positions INTEGER DEFAULT 0,
    
    -- 资金统计
    total_volume BIGINT DEFAULT 0,
    home_volume BIGINT DEFAULT 0,
    away_volume BIGINT DEFAULT 0,
    
    -- 赔率变化（可扩展用于动态赔率）
    initial_odds_home_bps INTEGER,
    initial_odds_away_bps INTEGER,
    current_odds_home_bps INTEGER,
    current_odds_away_bps INTEGER,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market_id ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_positions_wallet_address ON positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_timestamp ON positions(timestamp);
CREATE INDEX IF NOT EXISTS idx_positions_transaction_signature ON positions(transaction_signature);

CREATE INDEX IF NOT EXISTS idx_blockchain_events_signature ON blockchain_events(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_type ON blockchain_events(event_type);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_processed ON blockchain_events(processed);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_block_slot ON blockchain_events(block_slot);

CREATE INDEX IF NOT EXISTS idx_markets_state ON markets(state);
CREATE INDEX IF NOT EXISTS idx_markets_start_time ON markets(start_time);
CREATE INDEX IF NOT EXISTS idx_markets_address ON markets(market_address);

-- 创建触发器以自动更新统计数据
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新用户统计
    INSERT INTO user_stats (user_id, wallet_address, total_positions, updated_at)
    VALUES (NEW.user_id, NEW.wallet_address, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        total_positions = user_stats.total_positions + 1,
        open_positions = CASE 
            WHEN NEW.position_type = 'OPEN' THEN user_stats.open_positions + 1
            ELSE user_stats.open_positions
        END,
        closed_positions = CASE 
            WHEN NEW.position_type = 'CLOSE' THEN user_stats.closed_positions + 1
            ELSE user_stats.closed_positions
        END,
        total_volume = user_stats.total_volume + NEW.amount,
        max_position_size = GREATEST(user_stats.max_position_size, NEW.amount),
        last_trade_at = NEW.timestamp,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats
    AFTER INSERT ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats();

-- 创建触发器以自动更新市场统计
CREATE OR REPLACE FUNCTION update_market_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新市场统计
    INSERT INTO market_stats (market_id, market_address, total_positions, updated_at)
    VALUES (NEW.market_id, NEW.market_address, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (market_id)
    DO UPDATE SET 
        total_positions = market_stats.total_positions + 1,
        home_positions = CASE 
            WHEN NEW.selected_team = 1 THEN market_stats.home_positions + 1
            ELSE market_stats.home_positions
        END,
        away_positions = CASE 
            WHEN NEW.selected_team = 2 THEN market_stats.away_positions + 1
            ELSE market_stats.away_positions
        END,
        total_volume = market_stats.total_volume + NEW.amount,
        home_volume = CASE 
            WHEN NEW.selected_team = 1 THEN market_stats.home_volume + NEW.amount
            ELSE market_stats.home_volume
        END,
        away_volume = CASE 
            WHEN NEW.selected_team = 2 THEN market_stats.away_volume + NEW.amount
            ELSE market_stats.away_volume
        END,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_market_stats
    AFTER INSERT ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_market_stats();