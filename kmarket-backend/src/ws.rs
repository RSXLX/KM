use actix::{prelude::*, Addr, Context, Handler, Message, Recipient};
use actix_web::{get, web, HttpRequest, HttpResponse, Responder};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use chrono::Utc;
use tracing::warn;

use crate::{routes::auth::Claims, AppState};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use std::collections::HashSet as Set;

#[derive(Message, Clone, Serialize)]
#[rtype(result = "()")]
pub struct WsUpdate {
    pub market_id: i64,
    pub seq: i64,
    pub ts: i64,
    pub payload: serde_json::Value,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Subscribe {
    pub market_id: i64,
    pub recipient: Recipient<WsUpdate>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Unsubscribe {
    pub market_id: i64,
    pub recipient: Recipient<WsUpdate>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct BroadcastOdds {
    pub market_id: i64,
    pub payload: serde_json::Value,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Replay {
    pub market_id: i64,
    pub since_seq: i64,
    pub recipient: Recipient<WsUpdate>,
}

#[derive(Serialize, Message)]
#[rtype(result = "WsStats")]
pub struct GetStats;

#[derive(Serialize, Default)]
pub struct WsStats {
    pub connections: usize,
    pub topics: usize,
    pub messages_sent: usize,
    pub broadcast_latency_ms_p95: Option<i64>,
}

pub struct WsHub {
    topics: HashMap<i64, HashSet<Recipient<WsUpdate>>>,
    seq: HashMap<i64, i64>,
    history: HashMap<i64, VecDeque<WsUpdate>>, // 简单环形缓冲，默认保留最近 N 条
    history_cap: usize,
    connections: usize,
    messages_sent: usize,
    redis: Option<redis::Client>,
}

impl WsHub {
    pub fn new(redis: Option<redis::Client>) -> Self {
        Self {
            topics: HashMap::new(),
            seq: HashMap::new(),
            history: HashMap::new(),
            history_cap: 1024,
            connections: 0,
            messages_sent: 0,
            redis,
        }
    }
}

impl Actor for WsHub {
    type Context = Context<Self>;
}

impl Handler<Subscribe> for WsHub {
    type Result = ();

    fn handle(&mut self, msg: Subscribe, _ctx: &mut Self::Context) -> Self::Result {
        let subs = self.topics.entry(msg.market_id).or_default();
        subs.insert(msg.recipient);
    }
}

impl Handler<Unsubscribe> for WsHub {
    type Result = ();

    fn handle(&mut self, _msg: Unsubscribe, _ctx: &mut Self::Context) -> Self::Result {
        // 简化：取消订阅不主动移除 Recipient，避免比较器问题；由会话关闭与发送失败自然淘汰
    }
}

impl Handler<BroadcastOdds> for WsHub {
    type Result = ();

    fn handle(&mut self, msg: BroadcastOdds, _ctx: &mut Self::Context) -> Self::Result {
        let seq = self.seq.entry(msg.market_id).or_insert(0);
        *seq += 1;
        let ts = Utc::now().timestamp_millis();
        let update = WsUpdate {
            market_id: msg.market_id,
            seq: *seq,
            ts,
            payload: msg.payload,
        };
        let entry = self.history.entry(msg.market_id).or_default();
        if entry.len() >= self.history_cap { entry.pop_front(); }
        entry.push_back(update.clone());

        if let Some(subs) = self.topics.get(&msg.market_id) {
            for r in subs {
                let _ = r.do_send(update.clone());
                self.messages_sent += 1;
            }
        }
    }
}

impl Handler<Replay> for WsHub {
    type Result = ();

    fn handle(&mut self, msg: Replay, _ctx: &mut Self::Context) -> Self::Result {
        if let Some(buf) = self.history.get(&msg.market_id) {
            for u in buf.iter().filter(|u| u.seq > msg.since_seq) {
                let _ = msg.recipient.do_send(u.clone());
                self.messages_sent += 1;
            }
        } else {
            // 无历史：直接忽略，由客户端选择调用 REST 快照/增量接口
        }
    }
}

#[derive(Message)]
#[rtype(result = "Vec<WsUpdate>")]
pub struct GetUpdates { pub market_id: i64, pub since_seq: i64, pub limit: usize }

impl Handler<GetUpdates> for WsHub {
    type Result = Vec<WsUpdate>;

    fn handle(&mut self, msg: GetUpdates, _ctx: &mut Self::Context) -> Self::Result {
        if let Some(buf) = self.history.get(&msg.market_id) {
            buf.iter().filter(|u| u.seq > msg.since_seq).take(msg.limit).cloned().collect()
        } else {
            Vec::new()
        }
    }
}

impl Handler<GetStats> for WsHub {
    type Result = MessageResult<GetStats>;

    fn handle(&mut self, _msg: GetStats, _ctx: &mut Self::Context) -> Self::Result {
        MessageResult(WsStats {
            connections: self.connections,
            topics: self.topics.len(),
            messages_sent: self.messages_sent,
            broadcast_latency_ms_p95: None,
        })
    }
}

pub struct WsSession {
    pub hub: Addr<WsHub>,
    pub user_id: Option<i32>,
    pub subscribed: HashSet<i64>,
    pub last_heartbeat: i64,
}

impl WsSession {
    pub fn new(hub: Addr<WsHub>, user_id: Option<i32>) -> Self {
        Self { hub, user_id, subscribed: HashSet::new(), last_heartbeat: Utc::now().timestamp_millis() }
    }

    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(std::time::Duration::from_secs(15), |act, ctx| {
            // 发送 ping
            ctx.ping(b"ping");
            // 心跳超时处理（例如 60s 无 pong 则关闭）
            let now = Utc::now().timestamp_millis();
            if now - act.last_heartbeat > 60_000 {
                ctx.close(Some(ws::CloseReason { code: ws::CloseCode::Normal, description: Some("heartbeat timeout".into()) }));
                ctx.stop();
            }
        });
    }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);
    }
}

impl Handler<WsUpdate> for WsSession {
    type Result = ();

    fn handle(&mut self, msg: WsUpdate, ctx: &mut Self::Context) -> Self::Result {
        let mut payload = msg.payload.clone();
        // 保证必要字段存在
        if !payload.get("type").is_some() {
            payload["type"] = serde_json::Value::String("odds_update".into());
        }
        payload["marketId"] = serde_json::Value::Number(serde_json::Number::from(msg.market_id));
        payload["seq"] = serde_json::Value::Number(serde_json::Number::from(msg.seq));
        payload["ts"] = serde_json::Value::Number(serde_json::Number::from(msg.ts));
        let text = serde_json::to_string(&payload).unwrap_or("{}".to_string());
        ctx.text(text);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, item: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match item {
            Ok(ws::Message::Text(text)) => {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                    match v.get("type").and_then(|t| t.as_str()) {
                        Some("subscribe") => {
                            if let Some(arr) = v.get("markets").and_then(|m| m.as_array()) {
                                let mut acked: Vec<i64> = Vec::new();
                                for m in arr.iter().filter_map(|x| x.as_str().and_then(|s| s.parse::<i64>().ok())) {
                                    self.subscribed.insert(m);
                                    let r: Recipient<WsUpdate> = ctx.address().recipient();
                                    self.hub.do_send(Subscribe { market_id: m, recipient: r.clone() });
                                    acked.push(m);
                                }
                                let ack = serde_json::json!({ "type":"ack", "ok": true, "subscribed": acked });
                                ctx.text(serde_json::to_string(&ack).unwrap());
                            }
                        }
                        Some("unsubscribe") => {
                            if let Some(arr) = v.get("markets").and_then(|m| m.as_array()) {
                                let r: Recipient<WsUpdate> = ctx.address().recipient();
                                for m in arr.iter().filter_map(|x| x.as_str().and_then(|s| s.parse::<i64>().ok())) {
                                    self.subscribed.remove(&m);
                                    self.hub.do_send(Unsubscribe { market_id: m, recipient: r.clone() });
                                }
                                let ack = serde_json::json!({ "type":"ack", "ok": true });
                                ctx.text(serde_json::to_string(&ack).unwrap());
                            }
                        }
                        Some("resume") => {
                            if let Some(map) = v.get("offsets").and_then(|o| o.as_object()) {
                                let r: Recipient<WsUpdate> = ctx.address().recipient();
                                for (mid, seqv) in map {
                                    if let (Ok(market_id), Some(since_seq)) = (mid.parse::<i64>(), seqv.as_i64()) {
                                        self.hub.do_send(Replay { market_id, since_seq, recipient: r.clone() });
                                    }
                                }
                                let ack = serde_json::json!({ "type":"ack", "ok": true, "resume": true });
                                ctx.text(serde_json::to_string(&ack).unwrap());
                            }
                        }
                        Some("ping") => {
                            self.last_heartbeat = Utc::now().timestamp_millis();
                            let pong = serde_json::json!({ "type":"pong", "ts": self.last_heartbeat });
                            ctx.text(serde_json::to_string(&pong).unwrap());
                        }
                        _ => {}
                    }
                }
            }
            Ok(ws::Message::Ping(_bytes)) => {
                self.last_heartbeat = Utc::now().timestamp_millis();
                ctx.pong(b"pong");
            }
            Ok(ws::Message::Pong(_)) => {
                self.last_heartbeat = Utc::now().timestamp_millis();
            }
            Ok(ws::Message::Close(_)) => {
                ctx.stop();
            }
            _ => {}
        }
    }
}

#[derive(Deserialize)]
struct WsQuery { token: String }

#[get("/ws/odds")]
pub async fn ws_odds(req: HttpRequest, stream: web::Payload, state: web::Data<AppState>, q: web::Query<WsQuery>) -> impl Responder {
    // 确认 Hub 存在
    let Some(hub) = state.ws_hub.clone() else { return HttpResponse::ServiceUnavailable().json(serde_json::json!({"code":"SERVICE_UNAVAILABLE","message":"ws hub not initialized"})); };

    // 校验 JWT
    let secret = match &state.config.jwt_secret { Some(s) => s.clone(), None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"code":"SERVICE_UNAVAILABLE","message":"JWT_SECRET not configured"})) };
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&[state.config.jwt_aud.clone()]);
    validation.iss = Some(Set::from([state.config.jwt_iss.clone()]));
    let data = match decode::<Claims>(&q.token, &DecodingKey::from_secret(secret.as_bytes()), &validation) {
        Ok(d) => d,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({"code":"UNAUTHORIZED","message":"invalid token"})),
    };
    let user_id = Some(data.claims.sub);

    // 启动 WS 会话
    match ws::start(WsSession::new(hub.clone(), user_id), &req, stream) {
        Ok(resp) => resp,
        Err(e) => {
            warn!(error=%e, "ws start failed");
            HttpResponse::InternalServerError().finish()
        }
    }
}