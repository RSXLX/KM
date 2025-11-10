'use client';
import { useState } from 'react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('admin@kmarket.local');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        const msg = data?.error?.message || '登录失败';
        setError(msg);
        return;
      }
      const token = data?.data?.token;
      if (token) {
        localStorage.setItem('admin_token', token);
      }
      window.location.href = '/admin';
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">管理员登录</h1>
        {error && <div className="mb-3 text-red-500 text-sm">{error}</div>}
        <label className="block mb-2 text-sm">邮箱</label>
        <input className="w-full border rounded p-2 mb-4" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@kmarket.local" />
        <label className="block mb-2 text-sm">密码</label>
        <input className="w-full border rounded p-2 mb-4" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="******" />
        <button type="submit" className="w-full bg-black text-white py-2 rounded" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
      </form>
    </div>
  );
}