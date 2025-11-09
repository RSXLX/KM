use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// Frontend-aligned Market DTO (database.ts)
#[derive(Debug, Serialize, Deserialize)]
pub struct FrontendMarket {
    pub id: i64,
    pub market_id_seed: Option<String>,
    pub market_address: Option<String>,
    pub home_code: Option<i32>,
    pub away_code: Option<i32>,
    pub home_name: Option<String>,
    pub away_name: Option<String>,
    pub start_time: DateTime<Utc>,
    pub close_time: Option<DateTime<Utc>>,
    pub state: i32,
    pub result: i32,
    pub odds_home_bps: Option<i32>,
    pub odds_away_bps: Option<i32>,
    pub max_exposure: f64,
    pub current_exposure: f64,
    pub total_volume: f64,
    pub total_bets: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

// Frontend-aligned Position DTO (database.ts)
#[derive(Debug, Serialize, Deserialize)]
pub struct FrontendPosition {
    pub id: i64,
    pub user_id: i64,
    pub market_id: i64,
    pub wallet_address: String,
    pub market_address: Option<String>,
    pub bet_address: Option<String>,
    pub nonce: i64,
    pub position_type: String, // 'OPEN' | 'CLOSE'
    pub selected_team: i32,    // 1=Home, 2=Away
    pub amount: f64,           // numeric as number
    pub multiplier_bps: i32,
    pub odds_home_bps: Option<i32>,
    pub odds_away_bps: Option<i32>,
    pub payout_expected: Option<String>,
    pub status: i32,
    pub is_claimed: bool,
    pub pnl: f64,
    pub fee_paid: f64,
    pub close_price: Option<f64>,
    pub close_pnl: Option<f64>,
    pub timestamp: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub transaction_signature: Option<String>,
    pub block_slot: Option<i64>,
    pub confirmation_status: String,
}