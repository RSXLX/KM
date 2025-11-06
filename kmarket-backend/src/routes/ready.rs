use actix_web::{get, web::Data, HttpResponse, Responder};

use crate::AppState;

/// 就绪探针：检查关键依赖是否可用（DB/Redis/外部 API）
#[get("/readyz")]
pub async fn readyz(state: Data<AppState>) -> impl Responder {
    // 简化：若数据库或 Redis 未配置，则判定未就绪
    let db_ok = state.config.database_url.is_some();
    let redis_ok = state.config.redis_url.is_some();

    if db_ok && redis_ok {
        HttpResponse::Ok().json(serde_json::json!({ "ready": true }))
    } else {
        HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "ready": false,
            "requires": {
                "database_url": state.config.database_url.is_some(),
                "redis_url": state.config.redis_url.is_some()
            }
        }))
    }
}
