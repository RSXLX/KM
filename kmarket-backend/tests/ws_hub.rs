use actix::prelude::*;
use kmarket_backend::ws::{WsHub, BroadcastOdds, Subscribe, GetUpdates, GetStats, WsUpdate};

struct CaptureAddr { pub last: Option<WsUpdate> }
impl Actor for CaptureAddr { type Context = Context<Self>; }
impl actix::Handler<WsUpdate> for CaptureAddr { type Result = (); fn handle(&mut self, msg: WsUpdate, _ctx: &mut Self::Context) { self.last = Some(msg); } }

#[actix_rt::test]
async fn test_broadcast_and_ordering() {
    let hub = WsHub::new(None).start();
    // 创建捕捉器并订阅市场 100
    let cap = CaptureAddr { last: None }.start();
    let r = cap.recipient::<WsUpdate>();
    hub.do_send(Subscribe { market_id: 100, recipient: r });

    // 发送两次更新
    hub.do_send(BroadcastOdds { market_id: 100, payload: serde_json::json!({"odds_update": {"home":1.1,"away":2.2}}) });
    hub.do_send(BroadcastOdds { market_id: 100, payload: serde_json::json!({"odds_update": {"home":1.2,"away":2.3}}) });
    actix_rt::time::sleep(std::time::Duration::from_millis(50)).await;

    // 查询更新
    let ups = hub.send(GetUpdates { market_id: 100, since_seq: 0, limit: 10 }).await.unwrap();
    assert_eq!(ups.len(), 2);
    assert!(ups[0].seq < ups[1].seq);

    // 健康指标
    let stats = hub.send(GetStats).await.unwrap();
    assert!(stats.messages_sent >= 2);
}