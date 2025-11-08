use actix_web::{delete, get, post, put, web, HttpResponse, Responder, HttpMessage};
use serde::{Deserialize, Serialize};
use bcrypt::{hash, DEFAULT_COST};

use crate::{
    db,
    routes::auth_middleware::auth_middleware,
    routes::auth::Claims,
    AppState,
};

#[derive(Serialize)]
struct ErrorBody { code: &'static str, message: String }

fn claims_from_req(req: &actix_web::HttpRequest) -> Option<Claims> {
    req.extensions().get::<Claims>().cloned()
}

#[derive(Serialize)]
pub struct AdminUserResp {
    pub id: i32,
    pub userId: i32,
    pub username: String,
    pub permissions: serde_json::Value,
    pub status: String,
    pub address: Option<String>,
    pub role: Option<String>,
    pub createdAt: Option<i64>,
    pub updatedAt: Option<i64>,
}

#[derive(Deserialize)]
pub struct ListAdminsQuery { pub page: Option<i64>, pub pageSize: Option<i64>, pub q: Option<String> }

#[derive(Serialize)]
pub struct ListAdminsResp { pub page: i64, pub pageSize: i64, pub total: i64, pub items: Vec<AdminUserResp> }

#[get("/admins")]
pub async fn list_admins(state: web::Data<AppState>, q: web::Query<ListAdminsQuery>) -> impl Responder {
    let Some(pool) = &state.db_pool else { return HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".into() }); };
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.pageSize.unwrap_or(20).clamp(1, 200);
    let like = q.q.as_ref().map(|s| format!("%{}%", s));

    let total_row: (i64,) = match sqlx::query_as(
        "SELECT COUNT(*) FROM admin_accounts WHERE deleted_at IS NULL AND ($1::text IS NULL OR username ILIKE $1)"
    ).bind(like.as_ref()).fetch_one(pool).await { Ok(r) => r, Err(err) => return HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("count failed: {}", err) }) };
    let total = total_row.0;

    let rows: Result<Vec<(i32, i32, String, serde_json::Value, String, Option<String>, Option<String>, Option<chrono::NaiveDateTime>, Option<chrono::NaiveDateTime>)>, sqlx::Error> = sqlx::query_as(
        r#"SELECT a.id, a.user_id, a.username, a.permissions, a.status,
                   u.wallet_address, u.role, a.created_at, a.updated_at
            FROM admin_accounts a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE a.deleted_at IS NULL AND ($1::text IS NULL OR a.username ILIKE $1)
            ORDER BY a.created_at DESC
            LIMIT $2 OFFSET $3"#
    )
    .bind(like.as_ref())
    .bind(page_size)
    .bind((page - 1) * page_size)
    .fetch_all(pool).await;
    match rows {
        Ok(list) => {
            let items = list.into_iter().map(|(id, user_id, username, perms, status, address, role, c_at, u_at)| AdminUserResp {
                id, userId: user_id, username, permissions: perms, status,
                address, role,
                createdAt: c_at.map(|dt| dt.and_utc().timestamp_millis()),
                updatedAt: u_at.map(|dt| dt.and_utc().timestamp_millis()),
            }).collect();
            HttpResponse::Ok().json(ListAdminsResp { page, pageSize: page_size, total, items })
        }
        Err(err) => HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("list failed: {}", err) })
    }
}

#[derive(Deserialize)]
pub struct CreateAdminReq { pub username: String, pub password: String, pub walletAddress: Option<String>, pub permissions: Option<serde_json::Value> }

#[post("/admins")]
pub async fn create_admin(state: web::Data<AppState>, req: actix_web::HttpRequest, body: web::Json<CreateAdminReq>) -> Result<impl Responder, actix_web::Error> {
    let Some(claims) = claims_from_req(&req) else { return Ok(HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "missing token".into() })); };
    let Some(pool) = &state.db_pool else { return Ok(HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".into() })); };

    // Ensure unique username
    if let Ok(Some((_id,))) = sqlx::query_as::<_, (i32,)>("SELECT id FROM admin_accounts WHERE username = $1 AND deleted_at IS NULL")
        .bind(&body.username)
        .fetch_optional(pool).await {
        return Ok(HttpResponse::BadRequest().json(ErrorBody { code: "BAD_REQUEST", message: "username exists".into() }));
    }

    // Link or create user with role 'admin'
    let user_id = if let Some(addr) = &body.walletAddress {
        match db::repo::get_user_by_wallet(pool, addr).await {
            Ok(Some(u)) => {
                if u.role != "admin" {
                    let _ = sqlx::query("UPDATE users SET role='admin' WHERE id=$1").bind(u.id).execute(pool).await;
                }
                u.id
            }
            Ok(None) => {
                // create user record
                let row_res = sqlx::query_as::<_, (i32,)>("INSERT INTO users (wallet_address, display_name, role) VALUES ($1, $2, 'admin') RETURNING id")
                    .bind(addr)
                    .bind(&body.username)
                    .fetch_one(pool).await;
                match row_res {
                    Ok((id,)) => id,
                    Err(e) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("create user failed: {}", e) })),
                }
            }
            Err(err) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("read user failed: {}", err) })),
        }
    } else {
        // create a bare admin user without wallet
        let row_res = sqlx::query_as::<_, (i32,)>("INSERT INTO users (wallet_address, display_name, role) VALUES ($1, $2, 'admin') RETURNING id")
            .bind(format!("admin:{}", body.username))
            .bind(&body.username)
            .fetch_one(pool).await;
        match row_res { Ok((id,)) => id, Err(e) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("create user failed: {}", e) })) }
    };

    // Hash password
    let pwd_hash = match hash(&body.password, DEFAULT_COST) { Ok(h) => h, Err(err) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("hash failed: {}", err) })) };

    // Insert admin account
    let perms = body.permissions.clone().unwrap_or(serde_json::json!([]));
    let row: Result<(i32,), sqlx::Error> = sqlx::query_as(
        "INSERT INTO admin_accounts (user_id, username, password_hash, permissions, status) VALUES ($1, $2, $3, $4, 'active') RETURNING id"
    )
    .bind(user_id)
    .bind(&body.username)
    .bind(&pwd_hash)
    .bind(&perms)
    .fetch_one(pool).await;
    match row {
        Ok((id,)) => {
            // audit log
            let _ = sqlx::query("INSERT INTO admin_actions (admin_user_id, action_type, resource_type, resource_id, payload) VALUES ($1, 'ADMIN_CREATE', 'admin_account', $2, $3)")
                .bind(user_id)
                .bind(id.to_string())
                .bind(serde_json::json!({ "by": claims.address }))
                .execute(pool).await;
            return Ok(HttpResponse::Created().json(serde_json::json!({ "id": id })))
        }
        Err(err) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("create admin failed: {}", err) })),
    }
}

#[get("/admins/{id}")]
pub async fn get_admin(state: web::Data<AppState>, path: web::Path<i32>) -> impl Responder {
    let Some(pool) = &state.db_pool else { return HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".into() }); };
    let id = path.into_inner();
    let row: Result<Option<(i32, i32, String, serde_json::Value, String, Option<String>, Option<String>, Option<chrono::NaiveDateTime>, Option<chrono::NaiveDateTime>)>, sqlx::Error> = sqlx::query_as(
        r#"SELECT a.id, a.user_id, a.username, a.permissions, a.status,
                   u.wallet_address, u.role, a.created_at, a.updated_at
            FROM admin_accounts a LEFT JOIN users u ON u.id = a.user_id
            WHERE a.id = $1 AND a.deleted_at IS NULL"#
    ).bind(id).fetch_optional(pool).await;
    match row {
        Ok(Some((id, user_id, username, perms, status, address, role, c_at, u_at))) => {
            HttpResponse::Ok().json(AdminUserResp { id, userId: user_id, username, permissions: perms, status, address, role, createdAt: c_at.map(|dt| dt.and_utc().timestamp_millis()), updatedAt: u_at.map(|dt| dt.and_utc().timestamp_millis()) })
        }
        Ok(None) => HttpResponse::NotFound().json(ErrorBody { code: "NOT_FOUND", message: "admin not found".into() }),
        Err(err) => HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("read failed: {}", err) }),
    }
}

#[derive(Deserialize)]
pub struct UpdateAdminReq { pub username: Option<String>, pub password: Option<String>, pub permissions: Option<serde_json::Value>, pub status: Option<String> }

#[put("/admins/{id}")]
pub async fn update_admin(state: web::Data<AppState>, req: actix_web::HttpRequest, path: web::Path<i32>, body: web::Json<UpdateAdminReq>) -> Result<impl Responder, actix_web::Error> {
    let Some(claims) = claims_from_req(&req) else { return Ok(HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "missing token".into() })); };
    let Some(pool) = &state.db_pool else { return Ok(HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".into() })); };
    let id = path.into_inner();

    // fetch current
    let cur_res = sqlx::query_as::<_, (i32, i32)>("SELECT id, user_id FROM admin_accounts WHERE id=$1 AND deleted_at IS NULL").bind(id).fetch_optional(pool).await;
    let cur = match cur_res { Ok(opt) => opt, Err(e) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("read failed: {}", e) })) };
    let Some((_aid, user_id)) = cur else { return Ok(HttpResponse::NotFound().json(ErrorBody { code: "NOT_FOUND", message: "admin not found".into() })); };

    let mut pwd_hash: Option<String> = None;
    if let Some(pwd) = &body.password {
        pwd_hash = match hash(pwd, DEFAULT_COST) {
            Ok(h) => Some(h),
            Err(e) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("hash failed: {}", e) })),
        };
    }

    let res = sqlx::query(
        r#"UPDATE admin_accounts SET
            username = COALESCE($2, username),
            password_hash = COALESCE($3, password_hash),
            permissions = COALESCE($4, permissions),
            status = COALESCE($5, status),
            updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL"#
    )
    .bind(id)
    .bind(body.username.as_ref())
    .bind(pwd_hash.as_ref())
    .bind(body.permissions.as_ref())
    .bind(body.status.as_ref())
    .execute(pool).await;
    match res {
        Ok(_) => {
            let _ = sqlx::query("INSERT INTO admin_actions (admin_user_id, action_type, resource_type, resource_id, payload) VALUES ($1, 'ADMIN_UPDATE', 'admin_account', $2, $3)")
                .bind(user_id)
                .bind(id.to_string())
                .bind(serde_json::json!({ "by": claims.address }))
                .execute(pool).await;
            return Ok(HttpResponse::NoContent().finish())
        }
        Err(err) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("update failed: {}", err) })),
    }
}

#[delete("/admins/{id}")]
pub async fn delete_admin(state: web::Data<AppState>, req: actix_web::HttpRequest, path: web::Path<i32>) -> Result<impl Responder, actix_web::Error> {
    let Some(claims) = claims_from_req(&req) else { return Ok(HttpResponse::Unauthorized().json(ErrorBody { code: "UNAUTHORIZED", message: "missing token".into() })); };
    let Some(pool) = &state.db_pool else { return Ok(HttpResponse::ServiceUnavailable().json(ErrorBody { code: "SERVICE_UNAVAILABLE", message: "database not configured".into() })); };
    let id = path.into_inner();
    let cur_res = sqlx::query_as::<_, (i32, i32)>("SELECT id, user_id FROM admin_accounts WHERE id=$1 AND deleted_at IS NULL").bind(id).fetch_optional(pool).await;
    let cur = match cur_res { Ok(opt) => opt, Err(e) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("read failed: {}", e) })) };
    let Some((_aid, user_id)) = cur else { return Ok(HttpResponse::NotFound().json(ErrorBody { code: "NOT_FOUND", message: "admin not found".into() })); };

    let res = sqlx::query("UPDATE admin_accounts SET status='disabled', deleted_at = NOW(), updated_at = NOW() WHERE id=$1 AND deleted_at IS NULL")
        .bind(id)
        .execute(pool).await;
    match res {
        Ok(_) => {
            let _ = sqlx::query("INSERT INTO admin_actions (admin_user_id, action_type, resource_type, resource_id, payload) VALUES ($1, 'ADMIN_DELETE', 'admin_account', $2, $3)")
                .bind(user_id)
                .bind(id.to_string())
                .bind(serde_json::json!({ "by": claims.address }))
                .execute(pool).await;
            return Ok(HttpResponse::NoContent().finish())
        }
        Err(err) => return Ok(HttpResponse::InternalServerError().json(ErrorBody { code: "INTERNAL_ERROR", message: format!("delete failed: {}", err) })),
    }
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        actix_web::web::scope("/admins")
            .wrap(actix_web_lab::middleware::from_fn(auth_middleware))
            .service(list_admins)
            .service(create_admin)
            .service(get_admin)
            .service(update_admin)
            .service(delete_admin)
    );
}