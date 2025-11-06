use actix_web::{get, HttpResponse, Responder};

/// 存活探针：服务正常即返回 200 OK
#[get("/healthz")]
pub async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({ "status": "ok" }))
}
