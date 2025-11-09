import { NextRequest, NextResponse } from 'next/server';
// 事件历史与重试逻辑已迁移到后端PG服务。前端路由不再处理。

export async function GET(_request: NextRequest) {
  return NextResponse.json({ success: false, error: 'Not implemented. Use backend event history.' }, { status: 501 });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({ success: false, error: 'Not implemented. Use backend retry endpoints.' }, { status: 501 });
}

// 重试市场结算事件
async function retryMarketResolvedEvent(eventData: any, signature: string): Promise<boolean> {
  try {
    const { apiClient } = await import('@/lib/apiClient');
    const res = await apiClient.put(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/markets`, {
      market_address: eventData.market,
      state: 3,
      result: eventData.result,
      resolved_at: new Date().toISOString()
    }, { timeoutMs: 10000 });
    return !res || res.ok !== false;
  } catch (error) {
    console.error('Error retrying MarketResolved event:', error);
    return false;
  }
}