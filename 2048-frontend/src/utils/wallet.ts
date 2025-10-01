import { createWalletClient, custom } from "viem";
import { monadTestnet } from "./chains";

export async function connectAndGetEOAClient() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Please install MetaMask or another Web3 wallet.");
  }
  
  // Check if wallet is already connected
  let accounts;
  try {
    accounts = await window.ethereum.request({ method: 'eth_accounts' });
  } catch (error) {
    console.log("Could not check existing accounts:", error);
    accounts = [];
  }
  
  // If no accounts are connected, request connection
  if (!accounts || accounts.length === 0) {
    console.log("🔗 No wallet connected, requesting connection...");
    try {
      accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error("Please connect your wallet to continue. Click 'Connect' in your wallet popup.");
      }
      if (error.code === -32002) {
        throw new Error("Wallet connection request is pending. Please check your wallet.");
      }
      throw new Error("Failed to connect wallet: " + error.message);
    }
  } else {
    console.log("🔗 Wallet already connected with accounts:", accounts);
  }

  // Switch to Monad testnet after connecting
  console.log("🔄 Switching to Monad testnet...");
  await switchToMonadTestnet();
  
  const client = createWalletClient({
    chain: monadTestnet,
    transport: custom(window.ethereum)
  });
  
  const addresses = await client.getAddresses();
  if (!addresses || addresses.length === 0) {
    throw new Error("No wallet accounts found. Please make sure your wallet is connected and unlocked.");
  }
  
  console.log("🔗 Connected wallet addresses:", addresses);
  
  return {
    client,
    activeAddress: addresses[0],
    allAddresses: addresses
  };
}

export async function checkWalletConnection(): Promise<{isConnected: boolean, accounts: string[]}> {
  if (!window.ethereum) {
    return { isConnected: false, accounts: [] };
  }
  
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return { 
      isConnected: accounts && accounts.length > 0, 
      accounts: accounts || [] 
    };
  } catch (error) {
    console.log("Error checking wallet connection:", error);
    return { isConnected: false, accounts: [] };
  }
}

export async function switchToMonadTestnet() {
  if (!window.ethereum) {
    throw new Error("No wallet found to switch networks.");
  }
  
  const chainId = '0x279F'; // 10143 in hex
  
  try {
    // Try to switch to Monad testnet
    console.log("🔄 Attempting to switch to Monad testnet (chain ID: 10143)...");
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
    console.log("✅ Successfully switched to Monad testnet");
  } catch (switchError: any) {
    console.log("⚠️ Could not switch to Monad testnet, attempting to add it...", switchError);
    
    // If the chain hasn't been added to the user's wallet, add it
    if (switchError.code === 4902) {
      try {
        console.log("➕ Adding Monad testnet to wallet...");
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId,
              chainName: 'Monad Testnet',
              rpcUrls: ['https://testnet1.monad.xyz'],
              nativeCurrency: {
                name: 'MON',
                symbol: 'MON',
                decimals: 18,
              },
              blockExplorerUrls: ['https://testnet1.monad.xyz'],
            },
          ],
        });
        console.log("✅ Successfully added and switched to Monad testnet");
      } catch (addError: any) {
        console.error("❌ Failed to add Monad testnet:", addError);
        throw new Error("Failed to add Monad testnet to your wallet. Please add it manually.");
      }
    } else if (switchError.code === 4001) {
      throw new Error("Please approve the network switch to Monad testnet in your wallet.");
    } else {
      console.error("❌ Network switch error:", switchError);
      throw new Error("Failed to switch to Monad testnet. Please switch manually in your wallet.");
    }
  }
}

export async function getCurrentChainId(): Promise<string | null> {
  if (!window.ethereum) return null;
  
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId;
  } catch (error) {
    console.log("Error getting chain ID:", error);
    return null;
  }
}

export async function isOnMonadTestnet(): Promise<boolean> {
  const currentChainId = await getCurrentChainId();
  return currentChainId === '0x279F'; // 10143 in hex
} 