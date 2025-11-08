use actix_web::{post, web, HttpResponse, Responder};
use chrono::Utc;
use jsonwebtoken::{encode, Header, EncodingKey};
use serde::Deserialize;

use crate::{routes::auth::Claims, AppState};

#[derive(Deserialize)]
pub struct WsTokenRequest {
    pub userId: i32,
    pub scopeMarkets: Option<Vec<i64>>, // 预留字段，当前不强校验
    pub ttlSeconds: Option<usize>,
}

#[post("/ws/token")]
pub async fn ws_token(state: web::Data<AppState>, body: web::Json<WsTokenRequest>) -> impl Responder {
    let secret = match &state.config.jwt_secret { Some(s) => s.clone(), None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"code":"SERVICE_UNAVAILABLE","message":"JWT_SECRET not configured"})) };
    let now = Utc::now();
    let ttl = body.ttlSeconds.unwrap_or(600).min(3600); // 最多1小时
    let claims = Claims {
        sub: body.userId,
        address: "".into(),
        iat: now.timestamp() as usize,
        exp: (now.timestamp() as usize) + ttl,
        iss: state.config.jwt_iss.clone(),
        aud: state.config.jwt_aud.clone(),
        jti: uuid::Uuid::new_v4().to_string(),
        roles: vec!["ws".into()],
    };
    match encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes())) {
        Ok(token) => HttpResponse::Ok().json(serde_json::json!({"token": token, "expiresAt": (now.timestamp() as usize)+ttl })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({"code":"INTERNAL_ERROR","message": format!("encode failed: {}", err)})),
    }
}