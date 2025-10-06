import React from "react";
import { formatUnits } from "viem";
import { MON_DECIMALS } from "../constants";
import { useBalance } from "../hooks/useBalance";

interface BalanceDisplayProps {
  address: string;
}

export function BalanceDisplay({ address }: BalanceDisplayProps) {
  const { balance, loading } = useBalance(address);

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