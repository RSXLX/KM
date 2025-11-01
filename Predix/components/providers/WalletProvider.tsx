'use client';

import React, { useMemo } from 'react';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletProvider as AdapterWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const network: WalletAdapterNetwork =
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork) || WalletAdapterNetwork.Devnet;

  const endpoint = useMemo(() => {
    const custom = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    return custom && custom.length > 0 ? custom : clusterApiUrl(network);
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <AdapterWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </AdapterWalletProvider>
    </ConnectionProvider>
  );
}