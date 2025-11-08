use actix_web::{get, web::Data, HttpResponse, Responder};

use crate::AppState;

/// 就绪探针：检查关键依赖是否可用（DB/Redis/外部 API）
#[get("/readyz")]
pub async fn readyz(state: Data<AppState>) -> impl Responder {
    // 支持跳过连接健康检查（测试/受限环境）
    if state.config.skip_readyz_ping {
        let db_ok = state.config.database_url.is_some();
        let redis_ok = state.config.redis_url.is_some();
        if db_ok && redis_ok {
            return HttpResponse::Ok().json(serde_json::json!({ "ready": true }));
        } else {
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "ready": false,
                "requires": {
                    "database_url": state.config.database_url.is_some(),
                    "redis_url": state.config.redis_url.is_some()
                }
            }));
        }
    }

    // 真实连接检查
    let db_ok = match &state.db_pool {
        Some(pool) => sqlx::query("SELECT 1").execute(pool).await.is_ok(),
        None => false,
    };
    let redis_ok = match &state.redis_client {
        Some(client) => crate::cache::ping(client).await,
        None => false,
    };

    let jwt_ok = state.config.jwt_secret.is_some();
    if db_ok && redis_ok && jwt_ok {
        HttpResponse::Ok().json(serde_json::json!({ "ready": true }))
    } else {
        HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "ready": false,
            "requires": {
                "database": db_ok,
                "redis": redis_ok,
                "jwt_secret": jwt_ok
            }
        }))
    }
}