import { NextRequest, NextResponse } from 'next/server';
// Migrated to PostgreSQL backend (Actix). This route proxies health checks.

interface DatabaseHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    name?: string;
    tables?: string[];
    error?: string;
  };
  performance: {
    connectionTime?: number;
    queryTime?: number;
  };
}

// 数据库配置
function getBackendBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
}

export async function GET(_request: NextRequest) {
  try {
    const base = getBackendBase();
    const resp = await fetch(`${base.replace(/\/api\/v1$/, '')}/health`, { cache: 'no-store' });
    const json = await resp.json();
    const ok = resp.ok && json?.success;
    const result: DatabaseHealthResponse = {
      status: ok ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: !!json?.data?.database || json?.database === 'ok',
        name: 'kmarket',
        tables: [],
        error: ok ? undefined : (json?.error || 'backend health failed'),
      },
      performance: {},
    };
    return NextResponse.json(result, { status: ok ? 200 : 503 });
  } catch (e: any) {
    return NextResponse.json({ status: 'unhealthy', timestamp: new Date().toISOString(), database: { connected: false, error: e?.message || String(e) }, performance: {} }, { status: 503 });
  }
}

// 支持 POST 请求进行更详细的健康检查
export async function POST(_request: NextRequest) {
  // Detailed checks should be handled by backend service. Not implemented here.
  return NextResponse.json({ status: 'unhealthy', error: 'Not implemented. Use backend /health' }, { status: 501 });
}