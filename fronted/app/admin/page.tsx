export default function AdminDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">管理员控制台（MVP）</h1>
      <div className="grid grid-cols-1 gap-4">
        <a className="underline text-blue-600" href="/admin/markets">市场管理</a>
        <a className="underline text-blue-600" href="/admin/orders">订单管理</a>
        <a className="underline text-blue-600" href="/admin/users">用户管理</a>
      </div>
    </div>
  );
}