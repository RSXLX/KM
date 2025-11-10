'use client';
import { useEffect, useState } from 'react';

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
      const resp = await fetch('/api/admin/users');
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
    const resp = await fetch(`/api/admin/users/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '状态修改失败'); return; }
    await load();
  };

  const onBlacklist = async (id: number, val: boolean) => {
    setError(null);
    const resp = await fetch(`/api/admin/users/${id}/blacklist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: val }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '黑名单操作失败'); return; }
    await load();
  };

  const onWhitelist = async (id: number, val: boolean) => {
    setError(null);
    const resp = await fetch(`/api/admin/users/${id}/whitelist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: val }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '白名单操作失败'); return; }
    await load();
  };

  const openStats = async (id: number) => {
    setStatsUserId(id);
    setStats(null);
    const resp = await fetch(`/api/admin/users/${id}/stats`);
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '加载统计失败'); return; }
    setStats(data?.data || null);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">用户管理（MVP）</h1>
      {error && <div className="mb-3 text-red-500 text-sm">{error}</div>}
      {loading ? <div>加载中...</div> : (
        <table className="w-full text-left border">
          <thead>
            <tr className="border-b">
              <th className="p-2">ID</th>
              <th className="p-2">地址</th>
              <th className="p-2">状态</th>
              <th className="p-2">黑名单</th>
              <th className="p-2">白名单</th>
              <th className="p-2">盈亏/余额</th>
              <th className="p-2">操作</th>
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
                <td className="p-2 flex gap-2">
                  <button className="underline" onClick={() => openStats(it.id)}>统计</button>
                  <button className="underline" onClick={() => onStatus(it.id, 'active')}>设为活跃</button>
                  <button className="underline" onClick={() => onStatus(it.id, 'disabled')}>禁用</button>
                  <button className="underline" onClick={() => onBlacklist(it.id, !it.blacklisted)}>{it.blacklisted ? '移出黑名单' : '加入黑名单'}</button>
                  <button className="underline" onClick={() => onWhitelist(it.id, !it.whitelisted)}>{it.whitelisted ? '移出白名单' : '加入白名单'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {statsUserId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-full max-w-sm">
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