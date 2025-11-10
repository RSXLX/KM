/* Lightweight fetch wrapper with:
 * - Base URL handling via NEXT_PUBLIC_API_BASE_URL
 * - Request/response debug logging (toggle by NEXT_PUBLIC_API_DEBUG)
 * - Timeout and cancellation via AbortController
 * - Deduplication of in-flight requests
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestOptions {
  baseUrl?: string; // default from env
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: any;
  timeoutMs?: number; // default 10000
  signal?: AbortSignal;
  dedupKey?: string; // if provided, dedup on this key
  dedup?: boolean; // default true for GET
}

const inFlight = new Map<string, Promise<any>>();

function buildUrl(path: string, query?: RequestOptions['query'], base?: string): string {
  const baseUrl = base ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const isAbsolute = path.startsWith('http');
  const isFrontendApi = path.startsWith('/api/'); // 前端本地 API 路径应直接走同源，不叠加后端 baseUrl
  const full = isAbsolute ? path : (isFrontendApi ? path : `${baseUrl}${path}`);
  const url = new URL(full, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

function logDebug(title: string, obj: any) {
  const debug = (process.env.NEXT_PUBLIC_API_DEBUG ?? 'false') === 'true';
  if (!debug) return;
  try {
    console.groupCollapsed(`[api] ${title}`);
    console.log(obj);
    console.groupEnd();
  } catch {}
}

async function request(method: HttpMethod, path: string, opts: RequestOptions = {}) {
  const url = buildUrl(path, opts.query, opts.baseUrl);
  const headers: Record<string, string> = {
    ...(opts.headers ?? {}),
  };
  // Default JSON headers for write methods
  const isWrite = method !== 'GET';
  if (isWrite && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  // Authorization passthrough via env if present
  const token = process.env.NEXT_PUBLIC_API_TOKEN;
  if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 10000;
  const timeout = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), timeoutMs);
  const signal = opts.signal ?? controller.signal;

  const dedupDefault = method === 'GET';
  const dedupKey = opts.dedupKey ?? (opts.dedup ?? dedupDefault ? `${method}:${url}:${isWrite ? JSON.stringify(opts.body ?? {}) : ''}` : undefined);
  if (dedupKey && inFlight.has(dedupKey)) {
    return inFlight.get(dedupKey)!;
  }

  logDebug('request', { method, url, headers, body: opts.body });
  const p = fetch(url, {
    method,
    headers,
    body: isWrite && opts.body != null ? JSON.stringify(opts.body) : undefined,
    signal,
    cache: 'no-store',
  })
    .then(async (res) => {
      clearTimeout(timeout);
      const contentType = res.headers.get('Content-Type') || '';
      let raw: any = null;
      try {
        raw = contentType.includes('application/json') ? await res.json() : await res.text();
      } catch (e) {
        // noop
      }
      logDebug('response', { url, status: res.status, headers: Object.fromEntries(res.headers.entries()), raw });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}: ${typeof raw === 'string' ? raw : raw?.error || res.statusText}`);
        (err as any).raw = raw;
        (err as any).status = res.status;
        throw err;
      }
      return raw;
    })
    .catch((err) => {
      clearTimeout(timeout);
      console.error('[api] error', { method, url, err });
      throw err;
    })
    .finally(() => {
      if (dedupKey) inFlight.delete(dedupKey);
    });

  if (dedupKey) inFlight.set(dedupKey, p);
  return p;
}

export const apiClient = {
  get: (path: string, opts?: RequestOptions) => request('GET', path, opts),
  post: (path: string, body?: any, opts?: RequestOptions) => request('POST', path, { ...(opts ?? {}), body }),
  put: (path: string, body?: any, opts?: RequestOptions) => request('PUT', path, { ...(opts ?? {}), body }),
  delete: (path: string, opts?: RequestOptions) => request('DELETE', path, opts),
  request,
};

export default apiClient;