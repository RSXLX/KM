import { createClient } from 'viem';
import { mainnet, arbitrum, optimism, polygon } from 'viem/chains';
import { http } from 'viem';

// Simple viem client configuration for now
export const client = createClient({
  chain: mainnet,
  transport: http()
});

export const SUPPORTED_CHAINS = [mainnet, arbitrum, optimism, polygon];

// Placeholder config for compatibility
export const config = {
  chains: SUPPORTED_CHAINS,
  client
};