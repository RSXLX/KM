'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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
        document.cookie = `admin_token=${token}; path=/; max-age=1800; samesite=lax`;
      }
      window.location.href = '/admin';
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-card text-card-foreground p-6 rounded-md shadow">
        <h1 className="text-xl font-semibold mb-4">管理员登录</h1>
        {error && <div className="mb-3 text-sm text-destructive">{error}</div>}
        <div className="mb-3 space-y-2">
          <Label htmlFor="email" className="text-sm">邮箱</Label>
          <Input id="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@kmarket.local" />
        </div>
        <div className="mb-4 space-y-2">
          <Label htmlFor="password" className="text-sm">密码</Label>
          <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="******" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </Button>
      </form>
    </div>
  );
}