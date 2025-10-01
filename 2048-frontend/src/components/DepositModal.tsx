import React, { useState } from "react";
import { parseUnits, formatUnits } from "viem";
import { publicClient } from "../utils/client";
import { connectAndGetEOAClient, isOnMonadTestnet } from "../utils/wallet";
import { MON_DECIMALS, FUND_TRANSFER_TIMEOUT_ATTEMPTS, FUND_TRANSFER_RETRY_DELAY } from "../constants";

interface DepositModalProps {
  privyWalletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DepositModal({ privyWalletAddress, onClose, onSuccess }: DepositModalProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDeposit() {
    if (!amount || isNaN(Number(amount))) {
      setError("Please enter a valid amount");
      return;
    }

    const depositAmount = parseUnits(amount, MON_DECIMALS);
    if (depositAmount <= 0n) {
      setError("Amount must be greater than 0");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress("Connecting to your wallet...");

    try {
      const onMonad = await isOnMonadTestnet();
      if (!onMonad) {
        setProgress("Switching to Monad testnet...");
      }

      const { client: eoaClient, activeAddress } = await connectAndGetEOAClient();
      
      setProgress("Checking wallet balance...");
      const eoaBalance = await publicClient.getBalance({ address: activeAddress });
      
      if (eoaBalance < depositAmount) {
        throw new Error(`Insufficient balance. You have ${formatUnits(eoaBalance, MON_DECIMALS)} MON`);
      }

      setProgress("Transferring funds to your game wallet...");
      const txHash = await eoaClient.sendTransaction({
        account: activeAddress,
        to: privyWalletAddress as `0x${string}`,
        value: depositAmount,
      });

      console.log("Deposit transaction hash:", txHash);
      setProgress("Waiting for confirmation...");

      let retries = 0;
      let initialBalance = await publicClient.getBalance({ 
        address: privyWalletAddress as `0x${string}` 
      });

      while (retries < FUND_TRANSFER_TIMEOUT_ATTEMPTS) {
        const newBalance = await publicClient.getBalance({ 
          address: privyWalletAddress as `0x${string}` 
        });
        
        if (newBalance > initialBalance) {
          console.log("Funds arrived in Privy wallet");
          setProgress(null);
          setLoading(false);
          onSuccess();
          return;
        }
        
        await new Promise(res => setTimeout(res, FUND_TRANSFER_RETRY_DELAY));
        retries++;
      }

      throw new Error("Timeout waiting for funds to arrive");

    } catch (err: any) {
      console.error("Deposit error:", err);
      setError(err?.message || "Failed to deposit");
      setProgress(null);
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <h2 style={{ marginBottom: '24px', textAlign: 'center' }}>
          Deposit MON to Game Wallet
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Amount (MON)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '16px'
            }}
            step="0.000000000000000001"
            min="0"
          />
        </div>

        {error && (
          <div style={{
            padding: '12px',
            background: '#fee',
            color: '#c00',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {progress && (
          <div style={{
            padding: '12px',
            background: '#e3f2fd',
            color: '#1976d2',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {progress}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              background: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDeposit}
            disabled={loading || !amount}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: loading || !amount ? '#ccc' : '#667eea',
              color: 'white',
              cursor: loading || !amount ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Depositing...' : 'Deposit'}
          </button>
        </div>
      </div>
    </div>
  );
}