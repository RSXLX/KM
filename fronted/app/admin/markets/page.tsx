'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const resp = await fetch('/api/admin/markets', { headers: token ? { authorization: `Bearer ${token}` } : undefined });
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const resp = await fetch('/api/admin/markets', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const resp = await fetch(`/api/admin/markets/${id}/deactivate`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : undefined });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '下架失败'); return; }
    await load();
  };

  const onSettle = async (id: number, winningOption: number) => {
    setError(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const resp = await fetch(`/api/admin/markets/${id}/settle`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ winning_option: winningOption }) });
    const data = await resp.json();
    if (!resp.ok || !data?.success) { setError(data?.error?.message || '结算失败'); return; }
    await load();
  };

  return (
    <div className="p-6">
      <PageHeader title="市场管理" description="创建、上下架、结算" actions={<Button onClick={() => setShowCreate(true)}>新建市场</Button>} />
      {error && <div className="mb-3 text-red-500 text-sm">{error}</div>}
      {loading ? <div>加载中...</div> : (
        <table className="w-full text-left border rounded">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-xs text-muted-foreground">ID</th>
              <th className="p-2 text-xs text-muted-foreground">业务ID</th>
              <th className="p-2 text-xs text-muted-foreground">标题</th>
              <th className="p-2 text-xs text-muted-foreground">状态</th>
              <th className="p-2 text-xs text-muted-foreground">选项</th>
              <th className="p-2 text-xs text-muted-foreground">赔率(bps)</th>
              <th className="p-2 text-xs text-muted-foreground">操作</th>
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
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onDeactivate(it.id)}>下架</Button>
                    <Button variant="outline" size="sm" onClick={() => onSettle(it.id, 0)}>结算A胜</Button>
                    <Button variant="outline" size="sm" onClick={() => onSettle(it.id, 1)}>结算B胜</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <form onSubmit={onCreate} className="bg-card text-card-foreground p-6 rounded-md w-full max-w-lg shadow">
            <h2 className="text-lg font-semibold mb-4">新建市场</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="market_id" className="text-sm">业务ID</Label>
                <Input id="market_id" placeholder="业务ID" value={createForm.market_id} onChange={e => setCreateForm({ ...createForm, market_id: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm">标题</Label>
                <Input id="title" placeholder="标题" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="option_a" className="text-sm">选项A</Label>
                <Input id="option_a" placeholder="选项A" value={createForm.option_a} onChange={e => setCreateForm({ ...createForm, option_a: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="option_b" className="text-sm">选项B</Label>
                <Input id="option_b" placeholder="选项B" value={createForm.option_b} onChange={e => setCreateForm({ ...createForm, option_b: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_time" className="text-sm">开始时间</Label>
                <Input id="start_time" type="datetime-local" placeholder="开始时间" value={createForm.start_time} onChange={e => setCreateForm({ ...createForm, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time" className="text-sm">结束时间</Label>
                <Input id="end_time" type="datetime-local" placeholder="结束时间" value={createForm.end_time} onChange={e => setCreateForm({ ...createForm, end_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">状态</Label>
                <Select value={createForm.status} onValueChange={(v) => setCreateForm({ ...createForm, status: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="settled">settled</SelectItem>
                    <SelectItem value="cancelled">cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="odds_home_bps" className="text-sm">主队赔率bps</Label>
                <Input id="odds_home_bps" placeholder="主队赔率bps" value={createForm.odds_home_bps} onChange={e => setCreateForm({ ...createForm, odds_home_bps: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="odds_away_bps" className="text-sm">客队赔率bps</Label>
                <Input id="odds_away_bps" placeholder="客队赔率bps" value={createForm.odds_away_bps} onChange={e => setCreateForm({ ...createForm, odds_away_bps: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit">创建</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}