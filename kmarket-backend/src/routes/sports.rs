use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use sqlx::Row;

use crate::state::AppState;
use crate::utils::response::ApiResponse;

#[derive(Deserialize)]
pub struct FixturesQuery {
    pub status: Option<String>,
    pub sport: Option<String>,
    pub league: Option<String>,
    pub q: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn get_fixtures(state: web::Data<AppState>, query: web::Query<FixturesQuery>) -> Result<HttpResponse> {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    // Build COUNT SQL with positional binds ($1, $2, ...)
    let mut count_sql = String::from("SELECT COUNT(*) as total FROM sports_fixtures_v");
    let mut idx = 1;
    let mut has_where = false;
    if let Some(status) = &query.status {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("status = ${}", idx));
        idx += 1;
    }
    if let Some(sport) = &query.sport {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("sport = ${}", idx));
        idx += 1;
    }
    if let Some(league) = &query.league {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        count_sql.push_str(&format!("league = ${}", idx));
        idx += 1;
    }
    if let Some(_q) = &query.q {
        if !has_where { count_sql.push_str(" WHERE "); has_where = true; } else { count_sql.push_str(" AND "); }
        // three binds: title/home_team/away_team
        count_sql.push_str(&format!("(title ILIKE ${} OR home_team ILIKE ${} OR away_team ILIKE ${})", idx, idx + 1, idx + 2));
        idx += 3;
    }
    // Debug log
    tracing::info!(target: "kmarket_backend", "SQL COUNT: {}", count_sql);

    // Prepare COUNT query and bind values in same order
    let mut qc = sqlx::query(&count_sql);
    if let Some(status) = &query.status { qc = qc.bind(status); }
    if let Some(sport) = &query.sport { qc = qc.bind(sport); }
    if let Some(league) = &query.league { qc = qc.bind(league); }
    if let Some(q) = &query.q {
        let pat = format!("%{}%", q);
        qc = qc.bind(pat.clone()).bind(pat.clone()).bind(pat);
    }
    let row = qc.fetch_one(&state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    let total: i64 = row.try_get("total").unwrap_or(0);

    // Build DATA SQL similarly
    // Return business id (market_id) as id to the frontend for consistency
    // Cast to TEXT to avoid type mismatch when mapping to String in JSON response
    let mut data_sql = String::from("SELECT market_id::TEXT AS id, title, sport, league, home_team, away_team, kickoff_time, status, pre_odds, live_odds FROM sports_fixtures_v");
    let mut idx2 = 1;
    let mut has_where2 = false;
    if let Some(status) = &query.status {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("status = ${}", idx2));
        idx2 += 1;
    }
    if let Some(sport) = &query.sport {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("sport = ${}", idx2));
        idx2 += 1;
    }
    if let Some(league) = &query.league {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("league = ${}", idx2));
        idx2 += 1;
    }
    if let Some(_q) = &query.q {
        if !has_where2 { data_sql.push_str(" WHERE "); has_where2 = true; } else { data_sql.push_str(" AND "); }
        data_sql.push_str(&format!("(title ILIKE ${} OR home_team ILIKE ${} OR away_team ILIKE ${})", idx2, idx2 + 1, idx2 + 2));
        idx2 += 3;
    }
    data_sql.push_str(&format!(" ORDER BY kickoff_time DESC LIMIT ${} OFFSET ${}", idx2, idx2 + 1));
    tracing::info!(target: "kmarket_backend", "SQL DATA: {}", data_sql);

    // Prepare DATA query and bind values, then limit/offset
    let mut qd = sqlx::query(&data_sql);
    if let Some(status) = &query.status { qd = qd.bind(status); }
    if let Some(sport) = &query.sport { qd = qd.bind(sport); }
    if let Some(league) = &query.league { qd = qd.bind(league); }
    if let Some(q) = &query.q {
        let pat = format!("%{}%", q);
        qd = qd.bind(pat.clone()).bind(pat.clone()).bind(pat);
    }
    qd = qd.bind(limit).bind(offset);
    let rows = qd.fetch_all(&state.db_pool).await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    // Map to MockFixture-compatible shape
    let fixtures: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        let id: String = row.try_get("id").unwrap_or_default();
        let title: String = row.try_get("title").unwrap_or_default();
        let sport: String = row.try_get("sport").unwrap_or_else(|_| "Sports".into());
        let league: Option<String> = row.try_get("league").ok();
        let home_team: String = row.try_get("home_team").unwrap_or_default();
        let away_team: String = row.try_get("away_team").unwrap_or_default();
        let kickoff_time: chrono::DateTime<chrono::Utc> = row.try_get("kickoff_time").unwrap_or_else(|_| chrono::Utc::now());
        let status: String = row.try_get("status").unwrap_or_else(|_| "pre".into());
        let pre_odds: Option<serde_json::Value> = row.try_get("pre_odds").ok();
        let live_odds: Option<serde_json::Value> = row.try_get("live_odds").ok();

        serde_json::json!({
            "id": id,
            "title": title,
            "sport": sport,
            "league": league,
            "homeTeam": home_team,
            "awayTeam": away_team,
            "kickoffTime": kickoff_time,
            "status": status,
            "preOdds": pre_odds,
            "liveOdds": live_odds,
        })
    }).collect();

    let body = serde_json::json!({
        "fixtures": fixtures,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": ((total + limit - 1) / limit),
        }
    });
    Ok(HttpResponse::Ok().json(ApiResponse::success(body)))
}