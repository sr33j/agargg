import { useState, useCallback, useRef, useEffect } from 'react';
import { publicClient } from '../utils/client';

interface UseTransactionManagerReturn {
  getNonce: () => bigint;
  incrementNonce: () => void;
  resetNonce: () => Promise<void>;
  currentNonce: bigint;
  isInitialized: boolean;
}

export function useTransactionManager(userAddress: string | null): UseTransactionManagerReturn {
  const [currentNonce, setCurrentNonce] = useState<bigint>(0n);
  const [isInitialized, setIsInitialized] = useState(false);
  const nonceRef = useRef<bigint>(0n);

  // Fetch initial nonce from blockchain
  const fetchNonce = useCallback(async () => {
    if (!userAddress) return;

    try {
      const nonce = await publicClient.getTransactionCount({
        address: userAddress as `0x${string}`,
        blockTag: 'latest' // Use latest instead of pending for consistency
      });

      console.log(`🔢 Fetched nonce for ${userAddress}: ${nonce}`);
      nonceRef.current = BigInt(nonce);
      setCurrentNonce(BigInt(nonce));
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to fetch nonce:', error);
    }
  }, [userAddress]);

  // Reset nonce (fetch from blockchain)
  const resetNonce = useCallback(async () => {
    console.log('🔄 Resetting nonce...');
    setIsInitialized(false);
    await fetchNonce();
  }, [fetchNonce]);

  // Get current nonce without incrementing
  const getNonce = useCallback(() => {
    return nonceRef.current;
  }, []);

  // Increment nonce locally
  const incrementNonce = useCallback(() => {
    nonceRef.current = nonceRef.current + 1n;
    setCurrentNonce(nonceRef.current);
    console.log(`🔢 Incremented nonce to: ${nonceRef.current}`);
  }, []);

  // Initialize nonce on wallet connect/change
  useEffect(() => {
    if (userAddress) {
      fetchNonce();
    } else {
      // Reset if no user
      nonceRef.current = 0n;
      setCurrentNonce(0n);
      setIsInitialized(false);
    }
  }, [userAddress, fetchNonce]);

  // Periodically check if nonce is out of sync (safety mechanism)
  useEffect(() => {
    if (!userAddress || !isInitialized) return;

    const checkNonceSync = async () => {
      try {
        const blockchainNonce = await publicClient.getTransactionCount({
          address: userAddress as `0x${string}`,
          blockTag: 'latest'
        });

        // If blockchain nonce is higher, we're behind (some transactions confirmed)
        if (BigInt(blockchainNonce) > nonceRef.current) {
          console.log(`⚠️ Nonce out of sync. Local: ${nonceRef.current}, Blockchain: ${blockchainNonce}`);
          nonceRef.current = BigInt(blockchainNonce);
          setCurrentNonce(BigInt(blockchainNonce));
        }
      } catch (error) {
        console.error('Failed to check nonce sync:', error);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkNonceSync, 30000);
    return () => clearInterval(interval);
  }, [userAddress, isInitialized]);

  return {
    getNonce,
    incrementNonce,
    resetNonce,
    currentNonce,
    isInitialized
  };
}