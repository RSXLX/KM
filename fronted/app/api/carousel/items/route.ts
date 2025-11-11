import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { CarouselItem, CarouselCreatePayload, CarouselUpdatePayload } from '@/types/carousel';

const DATA_PATH = path.join(process.cwd(), 'lib', 'database', 'carousel.json');

async function readItems(): Promise<CarouselItem[]> {
  try {
    const buf = await fs.readFile(DATA_PATH, 'utf8');
    const items = JSON.parse(buf) as CarouselItem[];
    return Array.isArray(items) ? items : [];
  } catch (e) {
    return [];
  }
}

async function writeItems(items: CarouselItem[]): Promise<void> {
  const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  await fs.writeFile(DATA_PATH, JSON.stringify(sorted, null, 2), 'utf8');
}

export async function GET() {
  const items = await readItems();
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const payload = (await req.json()) as CarouselCreatePayload;
  const items = await readItems();
  const now = new Date().toISOString();
  const id = payload.id || Math.random().toString(36).slice(2, 10);
  const item: CarouselItem = {
    id,
    title: payload.title,
    subtitle: payload.subtitle,
    imageUrl: payload.imageUrl,
    href: payload.href,
    order: payload.order ?? items.length + 1,
    enabled: payload.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
  items.push(item);
  await writeItems(items);
  return NextResponse.json({ ok: true, item });
}

export async function PUT(req: Request) {
  const payload = (await req.json()) as CarouselUpdatePayload;
  const items = await readItems();
  const idx = items.findIndex(i => i.id === payload.id);
  if (idx === -1) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  const now = new Date().toISOString();
  items[idx] = {
    ...items[idx],
    ...payload,
    updatedAt: now,
  };
  await writeItems(items);
  return NextResponse.json({ ok: true, item: items[idx] });
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string };
  const items = await readItems();
  const next = items.filter(i => i.id !== id);
  await writeItems(next);
  return NextResponse.json({ ok: true });
}