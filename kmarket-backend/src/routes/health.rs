use actix_web::{HttpResponse, Result, web};
use crate::state::AppState;
use crate::utils::response::ApiResponse;

pub async fn health_check(state: web::Data<AppState>) -> Result<HttpResponse> {
    let ok = crate::state::heartbeat(&state.db_pool).await;
    let body = serde_json::json!({
        "database": if ok { "ok" } else { "unavailable" },
        "version": env!("CARGO_PKG_VERSION"),
    });
    Ok(HttpResponse::Ok().json(ApiResponse::success(body)))
}