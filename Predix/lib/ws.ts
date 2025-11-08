'use client';

type SubMsg = { type: 'subscribe'; markets: string[] };
type UnsubMsg = { type: 'unsubscribe'; markets: string[] };
type ResumeMsg = { type: 'resume'; offsets: Record<string, number> };
type ClientMsg = SubMsg | UnsubMsg | ResumeMsg;

export type WsUpdate = { type: string; payload: any; seq?: number; ts?: number };

export class OddsWS {
  private ws?: WebSocket;
  private url: string;
  private token?: string | null;
  private listeners: ((u: WsUpdate) => void)[] = [];
  private retry = 0;

  constructor(url = process.env.NEXT_PUBLIC_WS_URL || '') {
    this.url = url;
    this.token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  }

  on(fn: (u: WsUpdate) => void) { this.listeners.push(fn); }

  connect(markets: string[]) {
    const u = `${this.url}?token=${encodeURIComponent(this.token || '')}`;
    this.ws = new WebSocket(u);
    this.ws.onopen = () => {
      this.retry = 0;
      this.send({ type: 'subscribe', markets });
    };
    this.ws.onmessage = (ev) => {
      try { const msg = JSON.parse(ev.data); this.listeners.forEach(fn => fn(msg)); } catch { /* ignore */ }
    };
    this.ws.onclose = () => {
      const backoff = Math.min(1000 * Math.pow(2, this.retry++), 15000);
      setTimeout(() => this.connect(markets), backoff);
    };
  }

  send(msg: ClientMsg) { this.ws?.send(JSON.stringify(msg)); }

  close() { this.ws?.close(); }
}