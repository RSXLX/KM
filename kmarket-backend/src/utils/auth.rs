use actix_web::{HttpRequest, error::ErrorUnauthorized};
use jsonwebtoken::{DecodingKey, Validation, decode, Algorithm};
use serde::Deserialize;
use sqlx::{PgPool, Row};

#[derive(Deserialize)]
struct Claims { sub: String, exp: usize, iat: usize }

/// Validate Authorization: Bearer <JWT>, return admin_users.id
pub async fn admin_actor_id(req: &HttpRequest, pool: &PgPool) -> Result<i64, actix_web::Error> {
    let auth = req.headers().get("authorization").and_then(|v| v.to_str().ok()).unwrap_or("");
    if !auth.to_lowercase().starts_with("bearer ") {
        return Err(ErrorUnauthorized("missing_bearer"));
    }
    let token = auth.trim()[7..].trim();
    let secret = std::env::var("ADMIN_JWT_SECRET").unwrap_or_else(|_| "dev_admin_secret".to_string());
    let data = decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &Validation::new(Algorithm::HS256))
        .map_err(|_| ErrorUnauthorized("invalid_token"))?;
    let email = data.claims.sub;
    let row = sqlx::query("SELECT id FROM admin_users WHERE email = $1")
        .bind(email)
        .fetch_optional(pool)
        .await
        .map_err(|_| ErrorUnauthorized("auth_db_error"))?;
    if let Some(r) = row { Ok(r.try_get("id").unwrap_or(0)) } else { Err(ErrorUnauthorized("admin_not_found")) }
}