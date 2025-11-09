'use client';

import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 在服务端不渲染实际按钮，避免 SSR/CSR 标记差异导致的 hydration 警告
  if (!mounted) {
    return <div className="min-w-[160px] h-9" suppressHydrationWarning />;
  }

  return (
    <div suppressHydrationWarning>
      <WalletMultiButton className="min-w-[160px]" />
    </div>
  );
}