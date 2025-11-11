import PageHeader from '@/components/admin/PageHeader';

export default function AdminDashboard() {
  const cards = [
    { title: '市场管理', desc: '创建/编辑/上下架/结算', href: '/admin/markets' },
    { title: '订单管理', desc: '查询/取消/结算', href: '/admin/orders' },
    { title: '用户管理', desc: '状态/黑白名单/统计', href: '/admin/users' },
  ];
  return (
    <div className="p-6">
      <PageHeader title="管理员控制台" description="运营与风控管理" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(c => (
          <a key={c.href} href={c.href} className="group rounded-lg border p-4 hover:border-black transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold group-hover:underline">{c.title}</h2>
              <span className="text-xs text-muted-foreground">进入</span>
            </div>
            <p className="text-sm text-muted-foreground">{c.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}