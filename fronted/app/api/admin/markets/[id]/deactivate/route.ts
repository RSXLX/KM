export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
  const resp = await fetch(`${backend}/api/v1/admin/markets/${params.id}/deactivate`, { method: 'POST' });
  const ct = resp.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await resp.json() : { error: await resp.text() };
  return new Response(JSON.stringify(data), { status: resp.status, headers: { 'content-type': 'application/json' } });
}