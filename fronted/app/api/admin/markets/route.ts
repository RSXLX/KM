import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const resp = await fetch(`${backend}/api/v1/admin/markets${qs ? `?${qs}` : ''}`);
  const ct = resp.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await resp.json() : { error: await resp.text() };
  return new Response(JSON.stringify(data), { status: resp.status, headers: { 'content-type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  try {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
    const body = await req.json();
    const resp = await fetch(`${backend}/api/v1/admin/markets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const ct = resp.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await resp.json() : { error: await resp.text() };
    return new Response(JSON.stringify(data), { status: resp.status, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: { code: 'proxy_error', message: String(e?.message || e) } }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}