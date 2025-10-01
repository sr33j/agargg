import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

export function useWallet() {
  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [userAddress, setUserAddress] = useState<string>("");
  const [privyProvider, setPrivyProvider] = useState<any>(null);

  // Extract user address from Privy user
  useEffect(() => {
    if (!user || !authenticated) {
      setUserAddress("");
      return;
    }

    const privyWallet = user.linkedAccounts.find(
      (account) => account.type === "wallet" && account.walletClientType === "privy"
    );
    
    if (privyWallet && (privyWallet as any).address) {
      setUserAddress((privyWallet as any).address);
    } else {
      setUserAddress("");
    }
  }, [user, authenticated]);

  // Get Ethereum provider from wallet
  useEffect(() => {
    async function setupProvider() {
      if (!wallets?.length || !userAddress) {
        setPrivyProvider(null);
        return;
      }

      const userWallet = wallets.find((w) => w.walletClientType === "privy");
      if (!userWallet) {
        setPrivyProvider(null);
        return;
      }

      try {
        const ethereumProvider = await userWallet.getEthereumProvider();
        setPrivyProvider(ethereumProvider);
      } catch (error) {
        console.error("Failed to get Ethereum provider:", error);
        setPrivyProvider(null);
      }
    }

    setupProvider();
  }, [wallets, userAddress]);

  return {
    userAddress,
    privyProvider,
  };
} 