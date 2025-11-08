use actix_web::{get, post, web, HttpResponse, Responder};
use chrono::{Duration, Utc};
use ethers::types::Signature;
use ethers::utils::hash_message;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use tracing::{warn};
use std::str::FromStr;
use std::collections::HashSet;

use crate::{
    cache::store,
    db,
    services::user::PgUserService,
    AppState,
};
// Bring trait into scope to use PgUserService methods
use crate::services::user::UserService;

#[derive(Serialize)]
struct ErrorBody { code: &'static str, message: String }

#[derive(Deserialize)]
pub struct VerifySigRequest {
    pub address: String,
    pub message: String,
    pub signature: String,
}

#[derive(Serialize)]
pub struct VerifySigResponse {
    pub token: String,
    pub expiresIn: usize,
    pub user: VerifySigUser,
}

#[derive(Serialize)]
pub struct VerifySigUser { pub id: i32, pub address: String, pub role: String }

#[derive(Serialize)]
pub struct NonceResponse { pub nonce: String, pub expiresIn: usize }

#[derive(Serialize)]
pub struct MeResponse { pub id: i32, pub address: String, pub role: String, pub last_login: Option<i64> }

#[derive(Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: i32,
    pub address: String,
    pub iat: usize,
    pub exp: usize,
    pub iss: String,
    pub aud: String,
    pub jti: String,
    pub roles: Vec<String>,
}

pub fn bearer_token(req: &actix_web::HttpRequest) -> Option<String> {
    req.headers()
        .get(actix_web::http::header::AUTHORIZATION)
        .and_then(|hv| hv.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

fn extract_nonce(message: &str) -> Option<String> {
    // Expect pattern like: "Login to KMarket: nonce=abcd1234"
    if !message.starts_with("Login to KMarket") { return None; }
    message.split("nonce=")
        .nth(1)
        .map(|rest| rest.trim().to_string())
        .and_then(|s| {
            // take until first whitespace
            let token = s.split_whitespace().next().unwrap_or("");
            if token.is_empty() { None } else { Some(token.to_string()) }
        })
}

#[get("/auth/nonce")]
pub async fn nonce(state: web::Data<AppState>, q: web::Query<std::collections::HashMap<String, String>>) -> impl Responder {
    let Some(client) = &state.redis_client else {
        let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: "redis not configured".to_string() };
        return HttpResponse::ServiceUnavailable().json(body);
    };
    let Some(addr) = q.get("address").map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) else {
        let body = ErrorBody { code: "BAD_REQUEST", message: "address required".to_string() };
        return HttpResponse::BadRequest().json(body);
    };
    match store::get_conn(client).await {
        Ok(mut conn) => match store::issue_nonce(&mut conn, &addr).await {
            Ok(n) => HttpResponse::Ok().json(NonceResponse { nonce: n, expiresIn: 300 }),
            Err(err) => HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("issue nonce failed: {}", err) })
        },
        Err(err) => HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: format!("redis unavailable: {}", err) }),
    }
}

#[post("/auth/verify-sig")]
pub async fn verify_sig(state: web::Data<AppState>, body: web::Json<VerifySigRequest>) -> impl Responder {
    if state.config.jwt_secret.is_none() {
        let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: "JWT_SECRET not configured".to_string() };
        return HttpResponse::ServiceUnavailable().json(body);
    }
    let address = body.address.trim().to_string();
    let message = body.message.trim().to_string();
    let signature_hex = body.signature.trim().to_string();
    if address.is_empty() || message.is_empty() || signature_hex.is_empty() {
        let body = ErrorBody { code: "BAD_REQUEST", message: "address/message/signature required".to_string() };
        return HttpResponse::BadRequest().json(body);
    }

    // Nonce must be present and valid
    let Some(nonce_value) = extract_nonce(&message) else {
        let body = ErrorBody { code: "AUTH_FAILED", message: "nonce missing or invalid".to_string() };
        return HttpResponse::Unauthorized().json(body);
    };
    if let Some(client) = &state.redis_client {
        match store::get_conn(client).await {
            Ok(mut conn) => match store::consume_nonce(&mut conn, &address, &nonce_value).await {
                Ok(true) => {},
                Ok(false) => {
                    let body = ErrorBody { code: "AUTH_FAILED", message: "nonce invalid or expired".to_string() };
                    return HttpResponse::Unauthorized().json(body);
                },
                Err(err) => {
                    let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: format!("redis unavailable: {}", err) };
                    return HttpResponse::ServiceUnavailable().json(body);
                }
            },
            Err(err) => {
                let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: format!("redis unavailable: {}", err) };
                return HttpResponse::ServiceUnavailable().json(body);
            }
        }
    } else {
        let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: "redis not configured".to_string() };
        return HttpResponse::ServiceUnavailable().json(body);
    }

    // EIP-191 signature verification
    let msg_hash = hash_message(&message);
    let sig = match Signature::from_str(&signature_hex) {
        Ok(s) => s,
        Err(err) => {
            let body = ErrorBody { code: "BAD_REQUEST", message: format!("invalid signature format: {}", err) };
            return HttpResponse::BadRequest().json(body);
        }
    };
    let recovered = match sig.recover(msg_hash) {
        Ok(addr) => format!("{:?}", addr).to_lowercase(),
        Err(_) => {
            let body = ErrorBody { code: "AUTH_FAILED", message: "signature mismatch".to_string() };
            return HttpResponse::Unauthorized().json(body);
        }
    };
    if recovered != address.to_lowercase() {
        let body = ErrorBody { code: "AUTH_FAILED", message: "signature mismatch".to_string() };
        return HttpResponse::Unauthorized().json(body);
    }

    // Upsert user and update last_login via service
    let user_id = if let Some(pool) = &state.db_pool {
        let svc = PgUserService::new(pool.clone());
        match svc.ensure_login(&address).await {
            Ok(id) => id,
            Err(err) => return HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("user ensure_login failed: {}", err) }),
        }
    } else {
        let body = ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".to_string() };
        return HttpResponse::ServiceUnavailable().json(body);
    };

    // Issue JWT
    let now = Utc::now();
    let exp = now + Duration::days(state.config.jwt_exp_days);
    let claims = Claims {
        sub: user_id,
        address: address.clone(),
        iat: now.timestamp() as usize,
        exp: exp.timestamp() as usize,
        iss: state.config.jwt_iss.clone(),
        aud: state.config.jwt_aud.clone(),
        jti: uuid::Uuid::new_v4().to_string(),
        roles: vec!["user".into()],
    };
    let header = Header::new(Algorithm::HS256);
    let token = match encode(&header, &claims, &EncodingKey::from_secret(state.config.jwt_secret.as_ref().unwrap().as_bytes())) {
        Ok(t) => t,
        Err(err) => return HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("jwt encode failed: {}", err) }),
    };

    // Write session to Redis
    if let Some(client) = &state.redis_client {
        match store::get_conn(client).await {
            Ok(mut conn) => {
                let s = store::SessionData { user_id, address: address.clone() };
                let ttl_secs = (exp.timestamp() - now.timestamp()) as usize;
                if let Err(err) = store::create_session_with_ttl(&mut conn, &token, &s, ttl_secs).await {
                    warn!(error=%err, "Redis create_session_with_ttl failed");
                }
            }
            Err(err) => warn!(error=%err, "Redis manager init failed"),
        }
    }

    HttpResponse::Ok().json(VerifySigResponse { token, expiresIn: (exp.timestamp() - now.timestamp()) as usize, user: VerifySigUser { id: user_id, address, role: "user".into() } })
}

#[get("/auth/me")]
pub async fn auth_me(state: web::Data<AppState>, req: actix_web::HttpRequest) -> impl Responder {
    let Some(token) = bearer_token(&req) else {
        let body = ErrorBody { code: "UNAUTHORIZED", message: "missing bearer token".to_string() };
        return HttpResponse::Unauthorized().json(body);
    };

    let secret = match &state.config.jwt_secret {
        Some(s) => s.clone(),
        None => return HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "JWT_SECRET not configured".to_string() }),
    };
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&[state.config.jwt_aud.clone()]);
    validation.iss = Some(HashSet::from([state.config.jwt_iss.clone()]));
    let data = match decode::<Claims>(&token, &DecodingKey::from_secret(secret.as_bytes()), &validation) {
        Ok(d) => d,
        Err(_) => return HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "invalid token".to_string() }),
    };

    // Prefer Redis session for immediate revocation; fallback to DB when redis unavailable
    if let Some(client) = &state.redis_client {
        if let Ok(mut conn) = store::get_conn(client).await {
            match store::get_session(&mut conn, &token).await {
                Ok(Some(sess)) => {
                    // last_login from DB if available
                    if let Some(pool) = &state.db_pool {
                        if let Ok(Some(u)) = db::repo::get_user_by_wallet(pool, &sess.address).await {
                            let ts = u.last_login.map(|dt| dt.and_utc().timestamp_millis());
                            return HttpResponse::Ok().json(MeResponse { id: sess.user_id, address: sess.address, role: "user".into(), last_login: ts });
                        }
                    }
                    return HttpResponse::Ok().json(MeResponse { id: sess.user_id, address: sess.address, role: "user".into(), last_login: None });
                }
                Ok(None) => return HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "session not found".to_string() }),
                Err(err) => return HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("redis read failed: {}", err) }),
            }
        }
    }

    // Fallback to DB-only using claims
    if let Some(pool) = &state.db_pool {
        let svc = PgUserService::new(pool.clone());
        if let Ok(Some(u)) = svc.get_by_wallet(&data.claims.address).await {
            let ts = u.last_login.map(|dt| dt.and_utc().timestamp_millis());
            return HttpResponse::Ok().json(MeResponse { id: u.id, address: u.wallet_address, role: u.role, last_login: ts });
        }
    }
    HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "user not found".to_string() })
}

#[post("/auth/logout")]
pub async fn auth_logout(state: web::Data<AppState>, req: actix_web::HttpRequest) -> impl Responder {
    let Some(token) = bearer_token(&req) else {
        let body = ErrorBody { code: "UNAUTHORIZED", message: "missing bearer token".to_string() };
        return HttpResponse::Unauthorized().json(body);
    };
    if let Some(client) = &state.redis_client {
        match store::get_conn(client).await {
            Ok(mut conn) => {
                if let Err(err) = store::revoke_session(&mut conn, &token).await {
                    return HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("redis delete failed: {}", err) });
                }
                return HttpResponse::NoContent().finish();
            }
            Err(err) => return HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: format!("redis unavailable: {}", err) }),
        }
    }
    HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "redis not configured".to_string() })
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(nonce)
        .service(verify_sig)
        .service(auth_me)
        .service(auth_logout);
}