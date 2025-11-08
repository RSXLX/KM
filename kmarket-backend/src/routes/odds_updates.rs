use actix_web::{get, web, HttpResponse, Responder};
use crate::{ws::GetUpdates, AppState};

#[derive(serde::Deserialize)]
pub struct UpdatesQuery { pub since_seq: i64, pub limit: Option<usize> }

#[get("/markets/{market_id}/odds/updates")]
pub async fn odds_updates(state: web::Data<AppState>, path: web::Path<i64>, q: web::Query<UpdatesQuery>) -> impl Responder {
    let market_id = path.into_inner();
    let limit = q.limit.unwrap_or(200).min(2000);
    if let Some(hub) = &state.ws_hub {
        match hub.send(GetUpdates { market_id, since_seq: q.since_seq, limit }).await {
            Ok(list) => HttpResponse::Ok().json(serde_json::json!({
                "marketId": market_id,
                "fromSeq": q.since_seq,
                "toSeq": list.last().map(|u| u.seq).unwrap_or(q.since_seq),
                "updates": list.iter().map(|u| &u.payload).collect::<Vec<_>>()
            })),
            Err(_) => HttpResponse::ServiceUnavailable().json(serde_json::json!({"code":"SERVICE_UNAVAILABLE","message":"ws hub unavailable"})),
        }
    } else {
        HttpResponse::ServiceUnavailable().json(serde_json::json!({"code":"SERVICE_UNAVAILABLE","message":"ws hub not initialized"}))
    }
}