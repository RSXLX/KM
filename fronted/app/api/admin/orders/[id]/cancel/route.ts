export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${backend}/api/v1/admin/orders/${params.id}/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ct = resp.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await resp.json() : { error: await resp.text() };
  return new Response(JSON.stringify(data), { status: resp.status, headers: { 'content-type': 'application/json' } });
}