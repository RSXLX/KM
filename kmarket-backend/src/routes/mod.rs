use actix_web::web;

pub mod health;
pub mod markets;
pub mod ready;
pub mod odds;
pub mod markets_active;
pub mod markets_live;
pub mod session;
pub mod auth;
pub mod admin;
pub mod auth_middleware;
pub mod ws_health;
pub mod ws_token;
pub mod odds_snapshot;
pub mod odds_updates;
pub mod bets;
pub mod admin_users;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .service(health::healthz)
            .service(ready::readyz)
            .service(markets::list_markets)
            // 注意：具体路径应在动态路径之前注册，避免 /markets/{id} 捕获 /markets/inplay 等特定路由
            .service(markets_active::get_markets_active)
            .service(markets_live::get_markets_inplay)
            .service(markets::get_market)
            .service(odds::get_odds)
            .service(bets::post_bets)
            .service(bets::get_bet)
            .service(bets::list_bets)
            .service(bets::claim_bet)
            .service(session::create_session)
            .service(session::session_me)
            .service(session::revoke_session)
            .service(ws_health::ws_health)
            .service(ws_token::ws_token)
            .service(odds_snapshot::odds_snapshot)
            .service(odds_updates::odds_updates)
            .configure(auth::configure)
            .configure(admin::configure)
            .configure(admin_users::configure)
    );
}
