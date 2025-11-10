'use client';
import { useEffect, useState } from 'react';

type MarketItem = {
  id: number;
  market_id: number;
  title: string;
  status: string;
  option_a: string;
  option_b: string;
  start_time?: string;
  end_time?: string;
  odds_home_bps?: number | null;
  odds_away_bps?: number | null;
};

export default function AdminMarketsPage() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    market_id: '',
    title: '',
    option_a: '',
    option_b: '',
    start_time: '',
    end_time: '',
    status: 'pending',
    odds_home_bps: '',
    odds_away_bps: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin/markets');
      const data = await resp.json();
      const list = (data?.data?.items || []) as any[];
      setItems(list.map((x) => ({
        id: Number(x.id),
        market_id: Number(x.market_id),
        title: String(x.title || ''),
        status: String(x.status || ''),
        option_a: String(x.option_a || ''),
        option_b: String(x.option_b || ''),
        start_time: x.start_time,
        end_time: x.end_time,
        odds_home_bps: x.odds_home_bps ?? null,
        odds_away_bps: x.odds_away_bps ?? null,
      })));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        market_id: Number(createForm.market_id),
        title: createForm.title,
        option_a: createForm.option_a,
        option_b: createForm.option_b,
        start_time: new Date(createForm.start_time).toISOString(),
        end_time: new Date(createForm.end_time).toISOString(),
        status: createForm.status,
        odds_home_bps: createForm.odds_home_bps ? Number(createForm.odds_home_bps) : undefined,
        odds_away_bps: createForm.odds_away_bps ? Number(createForm.odds_away_bps) : undefined,
      };
      const resp = await fetch('/api/admin/markets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await resp.json();
      if (!resp.ok || !data?.success) { throw new Error(data?.error?.message || '创建失败'); }
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  const onDeactivate = async (id: number) => {
    setError(null);
    const resp = await fetch(`/api/admin/markets/${id}/deactivate`, { method: 'POST' });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '下架失败'); return; }
    await load();
  };

  const onSettle = async (id: number, winningOption: number) => {
    setError(null);
    const resp = await fetch(`/api/admin/markets/${id}/settle`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ winning_option: winningOption }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '结算失败'); return; }
    await load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">市场管理（MVP）</h1>
        <button className="bg-black text-white px-3 py-2 rounded" onClick={() => setShowCreate(true)}>新建市场</button>
      </div>
      {error && <div className="mb-3 text-red-500 text-sm">{error}</div>}
      {loading ? <div>加载中...</div> : (
        <table className="w-full text-left border">
          <thead>
            <tr className="border-b">
              <th className="p-2">ID</th>
              <th className="p-2">业务ID</th>
              <th className="p-2">标题</th>
              <th className="p-2">状态</th>
              <th className="p-2">选项</th>
              <th className="p-2">赔率(bps)</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-b">
                <td className="p-2">{it.id}</td>
                <td className="p-2">{it.market_id}</td>
                <td className="p-2">{it.title}</td>
                <td className="p-2">{it.status}</td>
                <td className="p-2">{it.option_a} / {it.option_b}</td>
                <td className="p-2">{it.odds_home_bps ?? '-'} / {it.odds_away_bps ?? '-'}</td>
                <td className="p-2">
                  <button className="mr-2 underline" onClick={() => onDeactivate(it.id)}>下架</button>
                  <button className="mr-2 underline" onClick={() => onSettle(it.id, 0)}>结算A胜</button>
                  <button className="underline" onClick={() => onSettle(it.id, 1)}>结算B胜</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <form onSubmit={onCreate} className="bg-white p-6 rounded w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-4">新建市场</h2>
            <div className="grid grid-cols-2 gap-3">
              <input className="border p-2" placeholder="业务ID" value={createForm.market_id} onChange={e => setCreateForm({ ...createForm, market_id: e.target.value })} />
              <input className="border p-2" placeholder="标题" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} />
              <input className="border p-2" placeholder="选项A" value={createForm.option_a} onChange={e => setCreateForm({ ...createForm, option_a: e.target.value })} />
              <input className="border p-2" placeholder="选项B" value={createForm.option_b} onChange={e => setCreateForm({ ...createForm, option_b: e.target.value })} />
              <input className="border p-2" type="datetime-local" placeholder="开始时间" value={createForm.start_time} onChange={e => setCreateForm({ ...createForm, start_time: e.target.value })} />
              <input className="border p-2" type="datetime-local" placeholder="结束时间" value={createForm.end_time} onChange={e => setCreateForm({ ...createForm, end_time: e.target.value })} />
              <select className="border p-2" value={createForm.status} onChange={e => setCreateForm({ ...createForm, status: e.target.value })}>
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="settled">settled</option>
                <option value="cancelled">cancelled</option>
              </select>
              <input className="border p-2" placeholder="主队赔率bps" value={createForm.odds_home_bps} onChange={e => setCreateForm({ ...createForm, odds_home_bps: e.target.value })} />
              <input className="border p-2" placeholder="客队赔率bps" value={createForm.odds_away_bps} onChange={e => setCreateForm({ ...createForm, odds_away_bps: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="px-3 py-2" onClick={() => setShowCreate(false)}>取消</button>
              <button type="submit" className="bg-black text-white px-3 py-2 rounded">创建</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}