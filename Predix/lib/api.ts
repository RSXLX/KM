import type { RequestInit } from 'node-fetch';
import type {
  BackendMarketItem as MarketListItem,
  BackendMarketList as MarketListResponse,
  BackendOddsQuote as OddsResponse,
  BackendOrder as OrderResp,
} from '@/types/backend';

export interface ApiError { code: string; message: string }

type Interceptors = {
  onRequest?: (opt: { ui?: { showLoading?: boolean; toastOnError?: boolean; toastOnSuccess?: boolean } } & RequestInit) => void;
  onResponse?: (res: Response, opt: { ui?: { showLoading?: boolean; toastOnError?: boolean; toastOnSuccess?: boolean } } & RequestInit) => void;
  onError?: (err: any, opt: { ui?: { showLoading?: boolean; toastOnError?: boolean; toastOnSuccess?: boolean } } & RequestInit) => void;
};

const _interceptors: Interceptors[] = [];
export function registerInterceptors(i: Interceptors) {
  _interceptors.push(i);
  return () => {
    const idx = _interceptors.indexOf(i);
    if (idx >= 0) _interceptors.splice(idx, 1);
  };
}

export const apiBase = () => process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function apiFetch<T = any>(path: string, init: RequestInit & { timeoutMs?: number; ui?: { showLoading?: boolean; toastOnError?: boolean; toastOnSuccess?: boolean } } = {}): Promise<T> {
  const base = apiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as any || {}),
  };
  const controller = new AbortController();
  const timeout = init.timeoutMs ?? 8000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    _interceptors.forEach(i => i.onRequest?.(init));
    const res = await fetch(url, { ...init, headers, signal: init.signal ?? controller.signal });
    if (!res.ok) {
      let payload: ApiError | undefined;
      try { payload = await res.json(); } catch { /* ignore */ }
      const err = new Error(`${payload?.code ?? res.status} ${payload?.message ?? res.statusText}`);
      (err as any).code = payload?.code ?? String(res.status);
      _interceptors.forEach(i => i.onError?.(err, init));
      throw err;
    }
    _interceptors.forEach(i => i.onResponse?.(res, init));
    return res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      const err = new Error('NETWORK_TIMEOUT');
      (err as any).code = 'NETWORK_TIMEOUT';
      _interceptors.forEach(i => i.onError?.(err, init));
      throw err;
    }
    _interceptors.forEach(i => i.onError?.(e, init));
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 统一类型来源：types/backend
export type { MarketListItem, MarketListResponse, OddsResponse, OrderResp };