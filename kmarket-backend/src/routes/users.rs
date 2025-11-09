use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use crate::state::AppState;
use crate::repository::user_repo::{UserRepository, CreateUserRequest};
use crate::utils::response::ApiResponse;

#[derive(Deserialize)]
pub struct CreateUserBody {
    pub address: String,
    pub username: Option<String>,
    pub email: Option<String>,
}

pub async fn create_user(state: web::Data<AppState>, body: web::Json<CreateUserBody>) -> Result<HttpResponse> {
    let repo = UserRepository::new(state.db_pool.clone());
    let user = repo.create(CreateUserRequest { address: body.address.clone(), username: body.username.clone(), email: body.email.clone(), password_hash: None, salt: None, status: Some("active".into()) })
        .await
        .map_err(|e| actix_web::error::ErrorBadRequest(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(user)))
}

#[derive(Deserialize)]
pub struct UserPath { pub id: i64 }

pub async fn get_user(state: web::Data<AppState>, path: web::Path<UserPath>) -> Result<HttpResponse> {
    let id = path.id;
    let rec = sqlx::query_as::<_, crate::models::user::User>(
        r#"SELECT id, address, username, email, password_hash, salt, status, version, created_at, updated_at FROM users WHERE id = $1"#
    )
    .bind(id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    match rec { Some(u) => Ok(HttpResponse::Ok().json(ApiResponse::success(u))), None => Ok(HttpResponse::NotFound().json(ApiResponse::<()>::error("NOT_FOUND", "user not found"))) }
}

#[derive(Deserialize)]
pub struct UpdateUserEmailBody { pub expected_version: i32, pub email: String }

pub async fn update_user_email(state: web::Data<AppState>, path: web::Path<UserPath>, body: web::Json<UpdateUserEmailBody>) -> Result<HttpResponse> {
    let repo = UserRepository::new(state.db_pool.clone());
    let updated = repo.update_email_with_version(path.id, body.expected_version, &body.email)
        .await
        .map_err(|e| actix_web::error::ErrorConflict(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(updated)))
}

pub async fn delete_user(state: web::Data<AppState>, path: web::Path<UserPath>) -> Result<HttpResponse> {
    let repo = UserRepository::new(state.db_pool.clone());
    repo.delete_by_id(path.id).await
        .map_err(|e| actix_web::error::ErrorNotFound(e))?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({"deleted": true, "id": path.id}))))
}