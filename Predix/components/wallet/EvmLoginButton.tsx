'use client';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

export function EvmLoginButton() {
  const login = async () => {
    if (!(window as any).ethereum) {
      alert('No EVM wallet found');
      return;
    }
    const eth = (window as any).ethereum;
    const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
    const address = accounts[0];
    const nonceRes = await apiFetch<{ nonce: string; expiresIn: number }>(`/auth/nonce?address=${address}`);
    const message = `Login to KMarket: nonce=${nonceRes.nonce}`;
    // personal_sign
    const signature = await eth.request({ method: 'personal_sign', params: [message, address] });
    const verify = await apiFetch<{ token: string }>(`/auth/verify-sig`, { method: 'POST', body: JSON.stringify({ address, message, signature }) });
    localStorage.setItem('jwt', verify.token);
    alert('Login success');
  };
  return (
    <Button variant="outline" onClick={login}>
      EVM Login
    </Button>
  );
}