import { createPublicClient, createWalletClient, custom, http } from "viem";
import { monadTestnet } from "./chains";

const rpc = import.meta.env.VITE_MONAD_RPC_URL

// Custom HTTP transport that adds the proper content-type header
const transport = http(rpc, {
  fetchOptions: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

export const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: transport,
});

// Create a wallet client for writes (using Privy or any EIP-1193 provider)
export function getWalletClient(provider: any) {
    return createWalletClient({
        chain: monadTestnet,
        transport: custom(provider),
    });
}
