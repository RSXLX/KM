'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ToastItem = { id: string; title?: string; message: string; type?: 'info' | 'success' | 'error' | 'warning'; ts: number };

type RequestManager = {
  inFlight: number;
  toasts: ToastItem[];
  addToast: (t: Omit<ToastItem, 'id' | 'ts'>) => void;
  removeToast: (id: string) => void;
};

const Ctx = createContext<RequestManager | null>(null);

function genId() { return Math.random().toString(36).slice(2); }

export function RequestProvider({ children }: { children: React.ReactNode }) {
  const [inFlight, setInFlight] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mounted = useRef(false);

  const addToast = (t: Omit<ToastItem, 'id' | 'ts'>) => {
    const item: ToastItem = { id: genId(), ts: Date.now(), ...t };
    setToasts(prev => [...prev.slice(-4), item]);
    // auto remove after 4s
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== item.id)), 4000);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(x => x.id !== id));

  // Register interceptors on mount
  useEffect(() => {
    mounted.current = true;
    let unreg: (() => void) | null = null;
    import('@/lib/api').then(mod => {
      const unregister = mod.registerInterceptors({
        onRequest: (opt) => {
          if (opt?.ui?.showLoading) setInFlight(c => c + 1);
        },
        onResponse: (resp, opt) => {
          if (opt?.ui?.showLoading) setInFlight(c => Math.max(0, c - 1));
          if (opt?.ui?.toastOnSuccess) addToast({ type: 'success', message: '请求成功' });
        },
        onError: (err, opt) => {
          if (opt?.ui?.showLoading) setInFlight(c => Math.max(0, c - 1));
          if (opt?.ui?.toastOnError) {
            const msg = (err as any)?.message || '请求失败';
            addToast({ type: 'error', message: msg });
          }
        }
      });
      unreg = unregister;
    });
    return () => { mounted.current = false; if (unreg) unreg(); };
  }, []);

  const value = useMemo<RequestManager>(() => ({ inFlight, toasts, addToast, removeToast }), [inFlight, toasts]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Global Loading Bar */}
      <div className="fixed top-0 left-0 right-0 z-[100]">
        {inFlight > 0 && <div className="h-1 bg-primary animate-pulse" />}
      </div>
      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`rounded shadow-lg px-3 py-2 text-sm bg-background border ${t.type === 'error' ? 'border-red-400 text-red-600' : t.type === 'success' ? 'border-emerald-400 text-emerald-600' : 'border-muted text-foreground'}`}> 
            {t.title && <div className="font-medium">{t.title}</div>}
            <div>{t.message}</div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useRequestManager() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRequestManager must be used within RequestProvider');
  return ctx;
}