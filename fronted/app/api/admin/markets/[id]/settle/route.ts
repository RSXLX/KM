import type { NextRequest } from 'next/server';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
  const body = await req.json();
  const auth = req.headers.get('authorization') || undefined;
  const tokenCookie = req.cookies.get('admin_token')?.value;
  const authHeader = auth || (tokenCookie ? `Bearer ${tokenCookie}` : undefined);
  const resp = await fetch(`${backend}/api/v1/admin/markets/${params.id}/settle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(authHeader ? { authorization: authHeader } : {}) },
    body: JSON.stringify(body),
  });
  const ct = resp.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await resp.json() : { error: await resp.text() };
  return new Response(JSON.stringify(data), { status: resp.status, headers: { 'content-type': 'application/json' } });
}