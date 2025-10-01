import React, { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { publicClient } from "../utils/client";
import { MON_DECIMALS } from "../constants";

interface BalanceDisplayProps {
  address: string;
  refreshInterval?: number;
}

export function BalanceDisplay({ address, refreshInterval = 5000 }: BalanceDisplayProps) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;

    const fetchBalance = async () => {
      try {
        const bal = await publicClient.getBalance({ 
          address: address as `0x${string}` 
        });
        setBalance(bal);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching balance:", error);
        setLoading(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, refreshInterval);
    
    return () => clearInterval(interval);
  }, [address, refreshInterval]);

  const formattedBalance = formatUnits(balance, MON_DECIMALS);
  const displayBalance = parseFloat(formattedBalance).toFixed(4);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      backdropFilter: 'blur(10px)',
    }}>
      <span style={{ fontSize: '14px', opacity: 0.8 }}>Balance:</span>
      <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
        {loading ? '...' : `${displayBalance} MON`}
      </span>
    </div>
  );
}