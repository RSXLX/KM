use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use sqlx::Row;
use chrono::{Utc, Duration};
use jsonwebtoken::{encode, EncodingKey, Header};
use argon2::{Argon2, PasswordHash, PasswordVerifier};

use crate::state::AppState;
use crate::utils::response::ApiResponse;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(serde::Serialize)]
struct Claims {
    sub: String,
    exp: usize,
    iat: usize,
}

pub async fn login(state: web::Data<AppState>, payload: web::Json<LoginRequest>) -> Result<HttpResponse> {
    let email = payload.email.trim();
    let password = payload.password.trim();

    // Lookup admin user
    let row = sqlx::query("SELECT id, email, password_hash, salt, status FROM admin_users WHERE email = $1")
        .bind(email)
        .fetch_optional(&state.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    if row.is_none() {
        // Audit: login failed (unknown user)
        let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, payload_json) VALUES ($1, $2, $3, $4)")
            .bind(0i64)
            .bind("admin.login_failed")
            .bind("admin_users")
            .bind(serde_json::json!({"email": email}))
            .execute(&state.db_pool)
            .await;
        return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()>::error("invalid_credentials", "invalid credentials")));
    }

    let row = row.unwrap();
    let admin_id: i64 = row.try_get("id").unwrap_or(0);
    let status: String = row.try_get("status").unwrap_or_else(|_| "active".into());
    if status != "active" {
        return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()>::error("account_disabled", "account disabled")));
    }

    let hash: String = row.try_get("password_hash").unwrap_or_default();
    let parsed_hash = PasswordHash::new(&hash)
        .map_err(|_| actix_web::error::ErrorInternalServerError("bad_hash"))?;
    let verifier = Argon2::default();
    let is_valid = verifier.verify_password(password.as_bytes(), &parsed_hash).is_ok();

    if !is_valid {
        // Audit: login failed (wrong password)
        let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id, payload_json) VALUES ($1, $2, $3, $4, $5)")
            .bind(admin_id)
            .bind("admin.login_failed")
            .bind("admin_users")
            .bind(admin_id)
            .bind(serde_json::json!({"email": email}))
            .execute(&state.db_pool)
            .await;
        return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()>::error("invalid_credentials", "invalid credentials")));
    }

    // Issue JWT
    let now = Utc::now();
    let exp = now + Duration::minutes(30);
    let claims = Claims { sub: email.to_string(), iat: now.timestamp() as usize, exp: exp.timestamp() as usize };
    let secret = std::env::var("ADMIN_JWT_SECRET").unwrap_or_else(|_| "dev_admin_secret".to_string());
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    // Audit: login success
    let _ = sqlx::query("INSERT INTO audit_logs (actor_id, action, resource, resource_id, payload_json) VALUES ($1, $2, $3, $4, $5)")
        .bind(admin_id)
        .bind("admin.login_success")
        .bind("admin_users")
        .bind(admin_id)
        .bind(serde_json::json!({"email": email}))
        .execute(&state.db_pool)
        .await;

    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"token": token}))))
}