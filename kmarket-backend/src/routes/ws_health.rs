use actix_web::{get, web, HttpResponse, Responder};
use crate::{ws::GetStats, AppState};

/// WebSocket 健康与统计指标
#[get("/ws/health")]
pub async fn ws_health(state: web::Data<AppState>) -> impl Responder {
    if let Some(hub) = &state.ws_hub {
        match hub.send(GetStats).await {
            Ok(stats) => HttpResponse::Ok().json(stats),
            Err(_) => HttpResponse::ServiceUnavailable().json(serde_json::json!({"code":"SERVICE_UNAVAILABLE","message":"ws hub unavailable"})),
        }
    } else {
        HttpResponse::ServiceUnavailable().json(serde_json::json!({"code":"SERVICE_UNAVAILABLE","message":"ws hub not initialized"}))
    }
}