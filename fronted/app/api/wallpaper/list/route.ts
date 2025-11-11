import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  const base = path.join(process.cwd(), 'lib', 'wallpapaer');
  try {
    const files = await fs.readdir(base);
    const images = files.filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
    return NextResponse.json({ ok: true, files: images });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'list_failed' }, { status: 500 });
  }
}