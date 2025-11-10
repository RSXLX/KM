'use client';
import { useEffect, useState } from 'react';

type OrderItem = {
  id: number;
  order_id: number;
  wallet_address: string;
  market_id: number;
  fixture_id: number;
  amount: string;
  odds: string;
  option: number;
  status: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
  close_price?: string | null;
  close_pnl?: string | null;
};

export default function AdminOrdersPage() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settleForm, setSettleForm] = useState({ id: '', close_price: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin/orders');
      const data = await resp.json();
      const list = (data?.data?.items || []) as any[];
      setItems(list.map((x) => ({
        id: Number(x.id),
        order_id: Number(x.order_id),
        wallet_address: String(x.wallet_address || ''),
        market_id: Number(x.market_id),
        fixture_id: Number(x.fixture_id),
        amount: String(x.amount),
        odds: String(x.odds),
        option: Number(x.option),
        status: String(x.status || ''),
        created_at: x.created_at,
        updated_at: x.updated_at,
        closed_at: x.closed_at,
        close_price: x.close_price,
        close_pnl: x.close_pnl,
      })));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCancel = async (id: number) => {
    setError(null);
    const resp = await fetch(`/api/admin/orders/${id}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'admin_cancel' }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '取消失败'); return; }
    await load();
  };

  const onOpenSettle = (id: number) => {
    setSettleForm({ id: String(id), close_price: '' });
  };

  const onSubmitSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = Number(settleForm.id);
    const close_price = Number(settleForm.close_price);
    if (!id || !close_price || close_price <= 0) { setError('请输入有效的结算价格'); return; }
    const resp = await fetch(`/api/admin/orders/${id}/settle`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ close_price }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '结算失败'); return; }
    setSettleForm({ id: '', close_price: '' });
    await load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">订单管理（MVP）</h1>
      {error && <div className="mb-3 text-red-500 text-sm">{error}</div>}
      {loading ? <div>加载中...</div> : (
        <table className="w-full text-left border">
          <thead>
            <tr className="border-b">
              <th className="p-2">ID</th>
              <th className="p-2">订单ID</th>
              <th className="p-2">用户地址</th>
              <th className="p-2">市场</th>
              <th className="p-2">金额/赔率</th>
              <th className="p-2">状态</th>
              <th className="p-2">结算</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-b">
                <td className="p-2">{it.id}</td>
                <td className="p-2">{it.order_id}</td>
                <td className="p-2">{it.wallet_address}</td>
                <td className="p-2">{it.market_id} / {it.fixture_id}</td>
                <td className="p-2">{it.amount} @ {it.odds}</td>
                <td className="p-2">{it.status}</td>
                <td className="p-2">{it.close_price ?? '-'} / {it.close_pnl ?? '-'}</td>
                <td className="p-2">
                  <button className="mr-2 underline" onClick={() => onCancel(it.id)}>取消</button>
                  <button className="underline" onClick={() => onOpenSettle(it.id)}>结算</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {settleForm.id && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <form onSubmit={onSubmitSettle} className="bg-white p-6 rounded w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">订单结算</h2>
            <input className="border p-2 w-full mb-3" placeholder="结算价格" value={settleForm.close_price} onChange={e => setSettleForm({ ...settleForm, close_price: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-2" onClick={() => setSettleForm({ id: '', close_price: '' })}>取消</button>
              <button type="submit" className="bg-black text-white px-3 py-2 rounded">确认结算</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}