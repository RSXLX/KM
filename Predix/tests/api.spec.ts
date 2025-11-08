import { describe, it, expect, beforeEach } from 'vitest';
import { apiFetch } from '@/lib/api';

describe('apiFetch', () => {
  beforeEach(() => {
    (global as any).fetch = async (url: string, init: any) => {
      return {
        ok: true,
        json: async () => ({ url, headers: init.headers }),
        status: 200,
        statusText: 'OK',
      } as any;
    };
    (process as any).env.NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8080/api/v1';
    (global as any).localStorage = { getItem: () => null };
  });

  it('prefixes base url and merges headers', async () => {
    const res = await apiFetch('/healthz');
    expect(res.url).toBe('http://127.0.0.1:8080/api/v1/healthz');
    expect(res.headers['Content-Type']).toBe('application/json');
  });

  it('handles non-OK status with error body', async () => {
    (global as any).fetch = async (_url: string, _init: any) => ({
      ok: false,
      json: async () => ({ code: 'NOT_FOUND', message: 'missing' }),
      status: 404,
      statusText: 'Not Found',
    });
    await expect(apiFetch('/markets')).rejects.toMatchObject({ message: expect.stringContaining('NOT_FOUND missing') });
  });

  it('handles timeout as NETWORK_TIMEOUT', async () => {
    (global as any).fetch = (_url: string, _init: any) => new Promise((_resolve, _reject) => { /* never resolves */ });
    await expect(apiFetch('/markets', { timeoutMs: 10 })).rejects.toMatchObject({ message: 'NETWORK_TIMEOUT' });
  });
});