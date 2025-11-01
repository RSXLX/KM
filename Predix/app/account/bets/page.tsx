'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ClosePositionModal } from '@/components/sports/ClosePositionModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LedgerItem {
  wallet: string;
  signature: string;
  network: string;
  rpc_url: string;
  direction: 'debit' | 'credit';
  delta_lamports: number;
  delta_sol: number;
  reason?: string | null;
  fixture_id?: string | null;
  status?: string | null;
  created_at: string;
  extra?: any;
}

function lamportsToSol(n?: number | null) {
  if (n == null) return 0;
  return n / 1_000_000_000;
}

export default function AccountBetRecordsPage() {
  const wallet = useWallet();
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const run = async () => {
      if (!wallet.publicKey) return;
      setLoading(true);
      setError(null);
      try {
        const url = `/api/wallet-ledger?wallet=${wallet.publicKey.toBase58()}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'fetch_failed');
        // Normalize extra JSON
        const normalized: LedgerItem[] = (json.items || []).map((r: any) => {
          let extra: any = r.extra;
          try {
            if (typeof extra === 'string') extra = JSON.parse(extra);
          } catch {}
          return { ...r, extra } as LedgerItem;
        });
        setItems(normalized);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [wallet.publicKey?.toBase58()]);

  const rows = useMemo(() => {
    return items.map((it) => {
      const feeSol = lamportsToSol(it.extra?.feeLamports);
      const status = it.status ?? (it.extra?.slot ? '已确认' : it.signature ? '已记录' : '处理中');
      return {
        time: new Date(it.created_at).toLocaleString(),
        matchId: it.extra?.matchId || it.fixture_id || '-',
        category: it.extra?.team || it.extra?.type || '-',
        betSize: it.extra?.amount ?? '-',
        fee: feeSol,
        delta: it.delta_sol,
        signature: it.signature,
        status,
        raw: it,
      } as const;
    });
  }, [items]);

  return (
    <ResponsiveLayout>
      <div className="p-6">
        <Card className="tech-card mb-6">
          <CardHeader>
            <CardTitle className="text-xl">我的投注</CardTitle>
          </CardHeader>
          <CardContent>
            {!wallet.publicKey && (
              <p className="text-sm text-muted-foreground">请先连接钱包以查看投注记录。</p>
            )}
            {wallet.publicKey && (
              <>
                <div className="text-sm text-muted-foreground mb-4">
                  钱包地址：{wallet.publicKey.toBase58()}
                </div>
                
                <Tabs defaultValue="history" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="history">历史记录</TabsTrigger>
                    <TabsTrigger value="positions">管理持仓</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="history" className="mt-4">
                    {loading && <p className="text-sm">加载中...</p>}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    {!loading && !error && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left">
                              <th className="py-2 pr-4">时间</th>
                              <th className="py-2 pr-4">比赛</th>
                              <th className="py-2 pr-4">类别</th>
                              <th className="py-2 pr-4">下注大小</th>
                              <th className="py-2 pr-4">扣费(SOL)</th>
                              <th className="py-2 pr-4">金额变动(SOL)</th>
                              <th className="py-2 pr-4">交易签名</th>
                              <th className="py-2 pr-4">状态</th>
                              <th className="py-2 pr-4">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, idx) => (
                              <>
                                <tr key={`${idx}-main`} className="border-t">
                                  <td className="py-2 pr-4">{r.time}</td>
                                  <td className="py-2 pr-4">{r.matchId}</td>
                                  <td className="py-2 pr-4">{r.category}</td>
                                  <td className="py-2 pr-4">{r.betSize}</td>
                                  <td className="py-2 pr-4">{r.fee?.toFixed ? r.fee.toFixed(9) : r.fee}</td>
                                  <td className="py-2 pr-4">{r.delta?.toFixed ? r.delta.toFixed(9) : r.delta}</td>
                                  <td className="py-2 pr-4 text-primary">
                                    <a href={`https://explorer.solana.com/tx/${r.signature}?cluster=devnet`} target="_blank" rel="noreferrer">{r.signature.slice(0, 10)}...</a>
                                  </td>
                                  <td className="py-2 pr-4">
                                    <span className="inline-block px-2 py-1 rounded bg-muted text-xs">{r.status}</span>
                                  </td>
                                  <td className="py-2 pr-4">
                                    <Button variant="outline" size="sm" onClick={() => setExpanded(prev => ({...prev, [r.signature]: !prev[r.signature]}))}>
                                      {expanded[r.signature] ? '收起' : '详情'}
                                    </Button>
                                  </td>
                                </tr>
                                {expanded[r.signature] && (
                                  <tr key={`${idx}-detail`} className="bg-muted">
                                    <td className="py-3 px-4" colSpan={9}>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                          <div className="font-medium mb-2">投注信息</div>
                                          <div className="text-sm">赔率: {r.raw.extra?.multiplier ?? '-'}</div>
                                          <div className="text-sm">预期赔付: {r.raw.extra?.payout ?? '-'}</div>
                                          <div className="text-sm">类型: {r.raw.extra?.type ?? '-'}</div>
                                          <div className="text-sm">队伍: {r.raw.extra?.team ?? '-'}</div>
                                        </div>
                                        <div>
                                          <div className="font-medium mb-2">区块链详情</div>
                                          <div className="text-sm">网络: {r.raw.network}</div>
                                          <div className="text-sm">方向: {r.raw.direction}</div>
                                          <div className="text-sm">手续费(SOL): {r.fee?.toFixed ? r.fee.toFixed(9) : r.fee}</div>
                                          <div className="text-sm">槽位: {r.raw.extra?.slot ?? '-'}</div>
                                          <div className="text-sm">完整签名: {r.signature}</div>
                                          <div className="text-sm">
                                            <a className="text-primary" href={`https://explorer.solana.com/tx/${r.signature}?cluster=devnet`} target="_blank" rel="noreferrer">在浏览器中查看</a>
                                          </div>
                                        </div>
                                        <div>
                                          <div className="font-medium mb-2">原始数据</div>
                                          <pre className="text-xs bg-background border rounded p-2 overflow-x-auto">{JSON.stringify(r.raw.extra ?? {}, null, 2)}</pre>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="positions" className="mt-4">
                    <div className="text-center">
                      <ClosePositionModal 
                        trigger={
                          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                            管理持仓
                          </Button>
                        }
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        点击按钮查看和管理您的开仓持仓
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
}