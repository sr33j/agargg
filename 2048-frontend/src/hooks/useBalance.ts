import { useEffect, useState, useRef } from 'react';
import { publicClient } from '../utils/client';
import { BALANCE_REFRESH_INTERVAL } from '../constants';

// Shared cache for balance data across all hook instances
const balanceCache = new Map<string, { balance: bigint; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 seconds cache

// Single interval for all balance fetching - prevents duplicate requests
let globalBalanceInterval: NodeJS.Timeout | null = null;
const subscribers = new Set<(address: string, balance: bigint) => void>();

function startGlobalBalanceFetching() {
  if (globalBalanceInterval) return;

  globalBalanceInterval = setInterval(async () => {
    const addressesToFetch = new Set<string>();
    
    // Collect all addresses that subscribers are interested in
    balanceCache.forEach((_, address) => {
      addressesToFetch.add(address);
    });

    if (addressesToFetch.size === 0) return;

    // Fetch balances in parallel
    await Promise.all(
      Array.from(addressesToFetch).map(async (address) => {
        try {
          const balance = await publicClient.getBalance({ 
            address: address as `0x${string}` 
          });
          
          const now = Date.now();
          balanceCache.set(address, { balance, timestamp: now });
          
          // Notify all subscribers
          subscribers.forEach(callback => callback(address, balance));
        } catch (error) {
          console.error(`Error fetching balance for ${address}:`, error);
        }
      })
    );
  }, BALANCE_REFRESH_INTERVAL);
}

function stopGlobalBalanceFetching() {
  if (globalBalanceInterval && subscribers.size === 0) {
    clearInterval(globalBalanceInterval);
    globalBalanceInterval = null;
  }
}

export function useBalance(address: string | null) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const addressRef = useRef(address);
  
  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  useEffect(() => {
    if (!address) {
      setBalance(0n);
      setLoading(false);
      return;
    }

    const fetchInitialBalance = async () => {
      // Check cache first
      const cached = balanceCache.get(address);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp < CACHE_DURATION)) {
        setBalance(cached.balance);
        setLoading(false);
        return;
      }

      // Fetch fresh data
      try {
        const bal = await publicClient.getBalance({ 
          address: address as `0x${string}` 
        });
        balanceCache.set(address, { balance: bal, timestamp: now });
        setBalance(bal);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching balance:", error);
        setLoading(false);
      }
    };

    // Subscriber callback
    const handleBalanceUpdate = (updateAddress: string, newBalance: bigint) => {
      if (updateAddress.toLowerCase() === addressRef.current?.toLowerCase()) {
        setBalance(newBalance);
      }
    };

    // Register subscriber
    subscribers.add(handleBalanceUpdate);
    startGlobalBalanceFetching();
    
    // Fetch initial balance
    fetchInitialBalance();

    return () => {
      subscribers.delete(handleBalanceUpdate);
      stopGlobalBalanceFetching();
    };
  }, [address]);

  return { balance, loading };
}

