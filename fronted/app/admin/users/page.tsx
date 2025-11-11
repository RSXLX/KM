'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/admin/PageHeader';

type UserItem = {
  id: number;
  address: string;
  username?: string | null;
  email?: string | null;
  status: string;
  total_pnl?: string | null;
  balance?: string | null;
  blacklisted: boolean;
  whitelisted: boolean;
  created_at?: string;
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsUserId, setStatsUserId] = useState<number | null>(null);
  const [stats, setStats] = useState<{ total_pnl?: string | null; balance?: string | null; order_count?: number } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const resp = await fetch('/api/admin/users', { headers: token ? { authorization: `Bearer ${token}` } : undefined });
      const data = await resp.json();
      const list = (data?.data?.items || []) as any[];
      setItems(list.map((x) => ({
        id: Number(x.id),
        address: String(x.address || ''),
        username: x.username ?? null,
        email: x.email ?? null,
        status: String(x.status || ''),
        total_pnl: x.total_pnl ?? null,
        balance: x.balance ?? null,
        blacklisted: Boolean(x.blacklisted),
        whitelisted: Boolean(x.whitelisted),
        created_at: x.created_at,
      })));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onStatus = async (id: number, status: string) => {
    setError(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const resp = await fetch(`/api/admin/users/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ status }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '状态修改失败'); return; }
    await load();
  };

  const onBlacklist = async (id: number, val: boolean) => {
    setError(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const resp = await fetch(`/api/admin/users/${id}/blacklist`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ value: val }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '黑名单操作失败'); return; }
    await load();
  };

  const onWhitelist = async (id: number, val: boolean) => {
    setError(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const resp = await fetch(`/api/admin/users/${id}/whitelist`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ value: val }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '白名单操作失败'); return; }
    await load();
  };

  const openStats = async (id: number) => {
    setStatsUserId(id);
    setStats(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const resp = await fetch(`/api/admin/users/${id}/stats`, { headers: token ? { authorization: `Bearer ${token}` } : undefined });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '加载统计失败'); return; }
    setStats(data?.data || null);
  };

  return (
    <div className="p-6">
      <PageHeader title="用户管理" description="状态、黑白名单、统计" />
      {error && <div className="mb-3 text-red-500 text-sm">{error}</div>}
      {loading ? <div>加载中...</div> : (
        <table className="w-full text-left border rounded">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-xs text-muted-foreground">ID</th>
              <th className="p-2 text-xs text-muted-foreground">地址</th>
              <th className="p-2 text-xs text-muted-foreground">状态</th>
              <th className="p-2 text-xs text-muted-foreground">黑名单</th>
              <th className="p-2 text-xs text-muted-foreground">白名单</th>
              <th className="p-2 text-xs text-muted-foreground">盈亏/余额</th>
              <th className="p-2 text-xs text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-b">
                <td className="p-2">{it.id}</td>
                <td className="p-2">{it.address}</td>
                <td className="p-2">{it.status}</td>
                <td className="p-2">{it.blacklisted ? '是' : '否'}</td>
                <td className="p-2">{it.whitelisted ? '是' : '否'}</td>
                <td className="p-2">{(it.total_pnl ?? '-')}/{(it.balance ?? '-')}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => openStats(it.id)}>统计</button>
                    <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => onStatus(it.id, 'active')}>设为活跃</button>
                    <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => onStatus(it.id, 'disabled')}>禁用</button>
                    <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => onBlacklist(it.id, !it.blacklisted)}>{it.blacklisted ? '移出黑名单' : '加入黑名单'}</button>
                    <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => onWhitelist(it.id, !it.whitelisted)}>{it.whitelisted ? '移出白名单' : '加入白名单'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {statsUserId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-full max-w-sm shadow">
            <h2 className="text-lg font-semibold mb-4">用户统计</h2>
            {stats ? (
              <div className="space-y-2">
                <div>订单数：{stats.order_count ?? '-'}</div>
                <div>Total PnL：{stats.total_pnl ?? '-'}</div>
                <div>Balance：{stats.balance ?? '-'}</div>
              </div>
            ) : (
              <div>加载中...</div>
            )}
            <div className="mt-4 text-right">
              <button className="px-3 py-2" onClick={() => setStatsUserId(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}