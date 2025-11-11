import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ ok: false, error: 'missing_file' }, { status: 400 });

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
      return NextResponse.json({ ok: false, error: 'invalid_ext' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);
    const base = path.join(process.cwd(), 'lib', 'wallpapaer');
    await fs.mkdir(base, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const target = path.join(base, safeName);
    await fs.writeFile(target, buf);

    return NextResponse.json({ ok: true, name: safeName, url: `/api/wallpaper/${safeName}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 500 });
  }
}