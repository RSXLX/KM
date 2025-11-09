use crate::models::dto::{FrontendMarket, FrontendPosition};
use crate::models::market::Market;
use chrono::{DateTime, Utc};
use sqlx::types::chrono;

pub fn map_market_to_frontend(m: &Market) -> FrontendMarket {
    FrontendMarket {
        id: m.id,
        market_id_seed: None,
        market_address: None,
        home_code: None,
        away_code: None,
        home_name: None,
        away_name: None,
        start_time: m.start_time,
        close_time: Some(m.end_time),
        state: 1, // Open
        result: match m.winning_option { Some(0) => 1, Some(1) => 2, _ => 0 },
        odds_home_bps: None,
        odds_away_bps: None,
        max_exposure: 0.0,
        current_exposure: 0.0,
        total_volume: 0.0,
        total_bets: 0,
        created_at: m.created_at,
        updated_at: m.updated_at,
        resolved_at: None,
    }
}

pub fn map_position_row_to_frontend(
    id: i64,
    user_id: i64,
    market_id: i64,
    wallet_address: String,
    market_address: Option<String>,
    nonce: i64,
    selected_team: i32,
    amount: f64,
    multiplier_bps: i32,
    status: i32,
    timestamp: DateTime<Utc>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
) -> FrontendPosition {
    FrontendPosition {
        id,
        user_id,
        market_id,
        wallet_address,
        market_address,
        bet_address: None,
        nonce,
        position_type: "OPEN".into(),
        selected_team,
        amount,
        multiplier_bps,
        odds_home_bps: None,
        odds_away_bps: None,
        payout_expected: None,
        status,
        is_claimed: false,
        pnl: 0.0,
        fee_paid: 0.0,
        close_price: None,
        close_pnl: None,
        timestamp,
        created_at,
        updated_at,
        closed_at: None,
        transaction_signature: None,
        block_slot: None,
        confirmation_status: "pending".into(),
    }
}