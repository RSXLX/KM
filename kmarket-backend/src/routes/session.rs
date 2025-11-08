use actix_web::{delete, get, post, web, HttpResponse, Responder};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use tracing::{warn};

use crate::{
    cache::store::{self, SessionData},
    services::user::PgUserService,
    AppState,
};
// Bring trait into scope to use PgUserService methods
use crate::services::user::UserService;

#[derive(Deserialize)]
pub struct SessionRequest { pub address: String, pub signature: String }

#[derive(Serialize)]
pub struct SessionCreateResponse { pub token: String, pub expiresIn: usize }

#[derive(Serialize)]
pub struct SessionMeResponse { pub userId: i32, pub address: String }

#[derive(Serialize)]
struct ErrorBody { code: &'static str, message: String }

#[derive(Serialize, Deserialize)]
struct Claims { sub: i32, address: String, exp: usize }

fn bearer_token(req: &actix_web::HttpRequest) -> Option<String> {
    req.headers().get(actix_web::http::header::AUTHORIZATION).and_then(|hv| hv.to_str().ok()).and_then(|s| s.strip_prefix("Bearer ")).map(|s| s.to_string())
}

#[post("/session")]
pub async fn create_session(state: web::Data<AppState>, body: web::Json<SessionRequest>) -> impl Responder {
    // 基础校验
    if state.config.jwt_secret.is_none() {
        let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: "JWT_SECRET not configured".to_string() };
        return HttpResponse::ServiceUnavailable().json(body);
    }

    let address = body.address.trim();
    if address.is_empty() {
        let body = ErrorBody { code: "BAD_REQUEST", message: "address required".to_string() };
        return HttpResponse::BadRequest().json(body);
    }

    // TODO: 验证签名；当前实现视为有效

    // 获取或创建用户（使用服务层）
    let user_id = if let Some(pool) = &state.db_pool {
        let svc = PgUserService::new(pool.clone());
        match svc.ensure_login(address).await {
            Ok(id) => id,
            Err(err) => {
                let body = ErrorBody { code: "INTERNAL_ERROR", message: format!("ensure_login failed: {}", err) };
                return HttpResponse::InternalServerError().json(body);
            }
        }
    } else {
        let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".to_string() };
        return HttpResponse::ServiceUnavailable().json(body);
    };

    // 生成 JWT
    let exp = (chrono::Utc::now().timestamp() as usize) + (7 * 24 * 3600);
    let claims = Claims { sub: user_id, address: address.to_string(), exp };
    let token = match encode(&Header::default(), &claims, &EncodingKey::from_secret(state.config.jwt_secret.as_ref().unwrap().as_bytes())) {
        Ok(t) => t,
        Err(err) => {
            let body = ErrorBody { code: "INTERNAL_ERROR", message: format!("jwt encode failed: {}", err) };
            return HttpResponse::InternalServerError().json(body);
        }
    };

    // 写入 Redis 会话
    if let Some(client) = &state.redis_client {
        match store::get_conn(client).await {
            Ok(mut conn) => {
                let s = SessionData { user_id, address: address.to_string() };
                if let Err(err) = store::create_session(&mut conn, &token, &s).await {
                    warn!(error=%err, "Redis create_session failed");
                }
            }
            Err(err) => warn!(error=%err, "Redis manager init failed"),
        }
    }

    HttpResponse::Created().json(SessionCreateResponse { token, expiresIn: 7 * 24 * 3600 })
}

#[get("/session/me")]
pub async fn session_me(state: web::Data<AppState>, req: actix_web::HttpRequest) -> impl Responder {
    let Some(token) = bearer_token(&req) else {
        let body = ErrorBody { code: "UNAUTHORIZED", message: "missing bearer token".to_string() };
        return HttpResponse::Unauthorized().json(body);
    };

    if let Some(client) = &state.redis_client {
        match store::get_conn(client).await {
            Ok(mut conn) => match store::get_session(&mut conn, &token).await {
                Ok(Some(sess)) => {
                    return HttpResponse::Ok().json(SessionMeResponse { userId: sess.user_id, address: sess.address });
                }
                Ok(None) => {
                    let body = ErrorBody { code: "UNAUTHORIZED", message: "session not found".to_string() };
                    return HttpResponse::Unauthorized().json(body);
                }
                Err(err) => {
                    let body = ErrorBody { code: "INTERNAL_ERROR", message: format!("redis read failed: {}", err) };
                    return HttpResponse::InternalServerError().json(body);
                }
            },
            Err(err) => {
                let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: format!("redis unavailable: {}", err) };
                return HttpResponse::ServiceUnavailable().json(body);
            }
        }
    } else {
        let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: "redis not configured".to_string() };
        HttpResponse::ServiceUnavailable().json(body)
    }
}

#[delete("/session")]
pub async fn revoke_session(state: web::Data<AppState>, req: actix_web::HttpRequest) -> impl Responder {
    let Some(token) = bearer_token(&req) else {
        let body = ErrorBody { code: "UNAUTHORIZED", message: "missing bearer token".to_string() };
        return HttpResponse::Unauthorized().json(body);
    };

    if let Some(client) = &state.redis_client {
        match store::get_conn(client).await {
            Ok(mut conn) => {
                if let Err(err) = store::revoke_session(&mut conn, &token).await {
                    let body = ErrorBody { code: "INTERNAL_ERROR", message: format!("redis delete failed: {}", err) };
                    return HttpResponse::InternalServerError().json(body);
                }
                HttpResponse::NoContent().finish()
            }
            Err(err) => {
                let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: format!("redis unavailable: {}", err) };
                HttpResponse::ServiceUnavailable().json(body)
            }
        }
    } else {
        let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: "redis not configured".to_string() };
        HttpResponse::ServiceUnavailable().json(body)
    }
}