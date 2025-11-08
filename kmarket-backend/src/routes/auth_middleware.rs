use actix_web::{dev::ServiceRequest, Error as ActixError, HttpMessage};
use actix_web_lab::middleware::Next;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use std::collections::HashSet;

use crate::routes::auth::Claims;
use crate::AppState;

pub async fn auth_middleware(
    req: ServiceRequest,
    next: Next<impl actix_web::body::MessageBody + 'static>,
) -> Result<actix_web::dev::ServiceResponse, ActixError> {
    // Extract app state
    let state = req
        .app_data::<actix_web::web::Data<AppState>>()
        .map(|d| d.get_ref().clone());

    let Some(state) = state else { return Err(actix_web::error::ErrorInternalServerError("missing app state")); };
    let token = crate::routes::auth::bearer_token(req.request()).ok_or_else(|| actix_web::error::ErrorUnauthorized("missing token"))?;

    let secret = state.config.jwt_secret.clone().ok_or_else(|| actix_web::error::ErrorServiceUnavailable("jwt not configured"))?;
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&[state.config.jwt_aud.clone()]);
    validation.iss = Some(HashSet::from([state.config.jwt_iss.clone()]));
    let data = decode::<Claims>(&token, &DecodingKey::from_secret(secret.as_bytes()), &validation)
        .map_err(|_| actix_web::error::ErrorUnauthorized("invalid token"))?;

    // Optional: check Redis session exists (enables revocation)
    if let Some(client) = &state.redis_client {
        if let Ok(mut conn) = crate::cache::store::get_conn(client).await {
            match crate::cache::store::get_session(&mut conn, &token).await {
                Ok(Some(_)) => {}
                Ok(None) => return Err(actix_web::error::ErrorUnauthorized("session revoked")),
                Err(_) => {}
            }
        }
    }

    // Inject claims into request extensions
    req.extensions_mut().insert(data.claims.clone());
    let res = next.call(req).await?;
    Ok(res.map_into_boxed_body())
}