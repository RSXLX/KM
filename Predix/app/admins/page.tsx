'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

type AdminItem = {
  id: number;
  userId: number;
  username: string;
  permissions: any;
  status: string;
  address?: string;
  role?: string;
  createdAt?: number;
  updatedAt?: number;
};

export default function AdminsPage() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState<AdminItem | null>(null);
  const [openDelete, setOpenDelete] = useState<AdminItem | null>(null);

  const fetchList = async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(q ? { q } : {}) }).toString();
      const data = await apiFetch<{ page: number; pageSize: number; total: number; items: AdminItem[] }>(`/admins?${qs}`, { ui: { showLoading: true, toastOnError: true } });
      setItems(data.items || []); setPage(data.page); setPageSize(data.pageSize); setTotal(data.total);
    } catch (e: any) { setError(e.message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, [page, pageSize, q]);

  const onCreate = async (payload: { username: string; password: string; walletAddress?: string; permissions?: any; }) => {
    try {
      await apiFetch(`/admins`, { method: 'POST', body: JSON.stringify(payload), ui: { toastOnError: true, toastOnSuccess: true } });
      setOpenCreate(false); fetchList();
    } catch {}
  };
  const onUpdate = async (id: number, payload: { username?: string; password?: string; permissions?: any; status?: string }) => {
    try {
      await apiFetch(`/admins/${id}`, { method: 'PUT', body: JSON.stringify(payload), ui: { toastOnError: true, toastOnSuccess: true } });
      setOpenEdit(null); fetchList();
    } catch {}
  };
  const onDelete = async (id: number) => {
    try {
      await apiFetch(`/admins/${id}`, { method: 'DELETE', ui: { toastOnError: true, toastOnSuccess: true } });
      setOpenDelete(null); fetchList();
    } catch {}
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">管理员管理</h1>
        <div className="flex gap-2">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索用户名" className="w-48" />
          <Button onClick={() => setOpenCreate(true)}>新增管理员</Button>
        </div>
      </div>

      {error && (<div className="mb-3 text-destructive">{error}</div>)}
      {loading && (<div className="mb-3 text-muted-foreground">加载中...</div>)}

      <Card>
        <CardContent className="p-0">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">用户名</th>
                <th className="p-2 text-left">地址</th>
                <th className="p-2 text-left">角色</th>
                <th className="p-2 text-left">状态</th>
                <th className="p-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{item.id}</td>
                  <td className="p-2">{item.username}</td>
                  <td className="p-2">{item.address || '-'}</td>
                  <td className="p-2">{item.role || '-'}</td>
                  <td className="p-2">{item.status}</td>
                  <td className="p-2 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setOpenEdit(item)}>编辑</Button>
                    <Button variant="destructive" size="sm" onClick={() => setOpenDelete(item)}>删除</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between p-2">
            <div>共 {total} 条</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p-1))}>上一页</Button>
              <div>第 {page} 页</div>
              <Button variant="outline" disabled={(page*pageSize) >= total} onClick={() => setPage(p => p+1)}>下一页</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增管理员</DialogTitle></DialogHeader>
          <CreateForm onSubmit={onCreate} onCancel={() => setOpenCreate(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!openEdit} onOpenChange={v => !v && setOpenEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑管理员</DialogTitle></DialogHeader>
          {openEdit && (<EditForm item={openEdit} onSubmit={(payload) => onUpdate(openEdit.id, payload)} onCancel={() => setOpenEdit(null)} />)}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!openDelete} onOpenChange={v => !v && setOpenDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除管理员</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>此操作不可逆。确定删除管理员 <span className="font-semibold">{openDelete?.username}</span>？</div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpenDelete(null)}>取消</Button>
              <Button variant="destructive" onClick={() => openDelete && onDelete(openDelete.id)}>删除</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateForm({ onSubmit, onCancel }: { onSubmit: (p: { username: string; password: string; walletAddress?: string; permissions?: any }) => void; onCancel: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [perms, setPerms] = useState<{ dashboard?: boolean; markets?: boolean; odds?: boolean; users?: boolean }>({});
  const valid = username.length >= 3 && password.length >= 6;
  return (
    <div className="space-y-3">
      <div>
        <Label>用户名</Label>
        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="至少3字符" />
      </div>
      <div>
        <Label>密码</Label>
        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="至少6字符" />
      </div>
      <div>
        <Label>钱包地址（可选）</Label>
        <Input value={walletAddress} onChange={e => setWalletAddress(e.target.value)} placeholder="0x... 或留空" />
      </div>
      <div>
        <Label>权限</Label>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {['dashboard','markets','odds','users'].map(key => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={(perms as any)[key] || false} onChange={e => setPerms(prev => ({ ...prev, [key]: e.target.checked }))} />
              <span>{key}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button disabled={!valid} onClick={() => onSubmit({ username, password, walletAddress: walletAddress || undefined, permissions: perms })}>创建</Button>
      </div>
    </div>
  );
}

function EditForm({ item, onSubmit, onCancel }: { item: AdminItem; onSubmit: (p: { username?: string; password?: string; permissions?: any; status?: string }) => void; onCancel: () => void }) {
  const [username, setUsername] = useState(item.username);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(item.status);
  const [perms, setPerms] = useState<{ [k: string]: boolean }>(() => ({ ...item.permissions }));
  const valid = username.length >= 3 && (status === 'active' || status === 'disabled');
  return (
    <div className="space-y-3">
      <div>
        <Label>用户名</Label>
        <Input value={username} onChange={e => setUsername(e.target.value)} />
      </div>
      <div>
        <Label>重置密码（可选）</Label>
        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="留空则不修改" />
      </div>
      <div>
        <Label>状态</Label>
        <select className="border rounded px-2 py-1" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
      </div>
      <div>
        <Label>权限</Label>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.keys(perms).length === 0 && ['dashboard','markets','odds','users'].forEach(k => perms[k] = false)}
          {['dashboard','markets','odds','users'].map(key => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={perms[key] || false} onChange={e => setPerms(prev => ({ ...prev, [key]: e.target.checked }))} />
              <span>{key}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button disabled={!valid} onClick={() => onSubmit({ username, status, permissions: perms, ...(password ? { password } : {}) })}>保存</Button>
      </div>
    </div>
  );
}