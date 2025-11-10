import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
    const resp = await fetch(`${backend}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const contentType = resp.headers.get('content-type') || '';
    if (!resp.ok) {
      const data = contentType.includes('application/json') ? await resp.json() : { error: await resp.text() };
      return new Response(JSON.stringify(data), { status: resp.status, headers: { 'content-type': 'application/json' } });
    }
    const data = contentType.includes('application/json') ? await resp.json() : { token: await resp.text() };
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: { code: 'proxy_error', message: String(e?.message || e) } }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}