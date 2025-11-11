import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(_: Request, { params }: { params: { name: string } }) {
  const file = params.name;
  const base = path.join(process.cwd(), 'lib', 'wallpapaer');
  const target = path.join(base, file);
  try {
    const buf = await fs.readFile(target);
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
    return new NextResponse(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
}