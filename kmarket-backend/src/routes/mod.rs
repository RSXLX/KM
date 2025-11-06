use actix_web::web;

pub mod health;
pub mod markets;
pub mod ready;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(health::healthz)
        .service(ready::readyz)
        .service(markets::list_markets)
        .service(markets::get_market);
}
