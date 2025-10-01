import React, { useState, useEffect } from "react";
import { parseUnits, formatUnits } from "viem";
import { publicClient, getWalletClient } from "../utils/client";
import { connectAndGetEOAClient, isOnMonadTestnet } from "../utils/wallet";
import { getStoredEOAAddress } from "../utils/eoaTracker";
import { MON_DECIMALS, FUND_TRANSFER_TIMEOUT_ATTEMPTS, FUND_TRANSFER_RETRY_DELAY } from "../constants";

interface WithdrawModalProps {
  privyWalletAddress: string;
  privyProvider: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function WithdrawModal({ privyWalletAddress, privyProvider, onClose, onSuccess }: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [privyBalance, setPrivyBalance] = useState<bigint>(0n);
  const [withdrawAll, setWithdrawAll] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const bal = await publicClient.getBalance({ 
          address: privyWalletAddress as `0x${string}` 
        });
        setPrivyBalance(bal);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    fetchBalance();
  }, [privyWalletAddress]);

  const balanceDisplay = formatUnits(privyBalance, MON_DECIMALS);
  const gasReserve = parseUnits("0.01", MON_DECIMALS); // Reserve 0.01 MON for gas
  const maxWithdrawable = privyBalance > gasReserve ? privyBalance - gasReserve : 0n;
  const maxWithdrawableDisplay = formatUnits(maxWithdrawable, MON_DECIMALS);

  async function handleWithdraw() {
    if (!withdrawAll && (!amount || isNaN(Number(amount)))) {
      setError("Please enter a valid amount or select 'Withdraw All'");
      return;
    }

    let withdrawAmount: bigint;
    if (withdrawAll) {
      withdrawAmount = maxWithdrawable;
    } else {
      withdrawAmount = parseUnits(amount, MON_DECIMALS);
    }

    if (withdrawAmount <= 0n) {
      setError("Amount must be greater than 0");
      return;
    }

    if (withdrawAmount > maxWithdrawable) {
      setError(`Maximum withdrawable amount is ${maxWithdrawableDisplay} MON (after gas reserves)`);
      return;
    }

    setLoading(true);
    setError(null);
    setProgress("Connecting to your wallet...");

    try {
      // Check if we're on the right network
      const onMonad = await isOnMonadTestnet();
      if (!onMonad) {
        setProgress("Switching to Monad testnet...");
      }

      // Get the withdrawal destination address
      let withdrawalAddress = getStoredEOAAddress(privyWalletAddress);
      
      if (!withdrawalAddress) {
        setProgress("Getting wallet address...");
        const { activeAddress } = await connectAndGetEOAClient();
        withdrawalAddress = activeAddress;
      }

      setProgress("Preparing withdrawal transaction...");
      
      const client = getWalletClient(privyProvider);
      
      console.log("Withdrawal details:", {
        from: privyWalletAddress,
        to: withdrawalAddress,
        amount: withdrawAmount.toString(),
        balance: privyBalance.toString(),
        gasReserve: gasReserve.toString()
      });

      setProgress("Sending funds to your wallet...");
      const txHash = await client.sendTransaction({
        account: privyWalletAddress as `0x${string}`,
        to: withdrawalAddress as `0x${string}`,
        value: withdrawAmount,
      });

      console.log("Withdrawal transaction hash:", txHash);
      setProgress("Waiting for confirmation...");

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash as `0x${string}` 
      });

      if (receipt.status === 'success') {
        setProgress(null);
        setLoading(false);
        onSuccess();
      } else {
        throw new Error("Transaction failed");
      }

    } catch (err: any) {
      console.error("Withdrawal error:", err);
      setError(err?.shortMessage || err?.message || "Failed to withdraw");
      setProgress(null);
      setLoading(false);
    }
  }

  function handleWithdrawAll() {
    setWithdrawAll(true);
    setAmount(maxWithdrawableDisplay);
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
          Withdraw MON to Wallet
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            padding: '12px', 
            background: '#f0f0f0', 
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
              Game Wallet Balance
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {parseFloat(balanceDisplay).toFixed(4)} MON
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Max withdrawable: {parseFloat(maxWithdrawableDisplay).toFixed(4)} MON
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Amount (MON)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setWithdrawAll(false);
            }}
            placeholder="0.0"
            disabled={loading || withdrawAll}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '16px',
              opacity: withdrawAll ? 0.6 : 1
            }}
            step="0.000000000000000001"
            min="0"
            max={maxWithdrawableDisplay}
          />
          
          <button
            onClick={handleWithdrawAll}
            disabled={loading || maxWithdrawable === 0n}
            style={{
              marginTop: '8px',
              padding: '8px',
              width: '100%',
              borderRadius: '6px',
              border: '1px solid #667eea',
              background: withdrawAll ? '#667eea' : 'white',
              color: withdrawAll ? 'white' : '#667eea',
              cursor: loading || maxWithdrawable === 0n ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            Withdraw All Available
          </button>
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
            onClick={handleWithdraw}
            disabled={loading || (!amount && !withdrawAll) || privyBalance === 0n}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: loading || (!amount && !withdrawAll) || privyBalance === 0n ? '#ccc' : '#667eea',
              color: 'white',
              cursor: loading || (!amount && !withdrawAll) || privyBalance === 0n ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div>
        
        {privyBalance === 0n && (
          <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
            No funds available to withdraw
          </div>
        )}
      </div>
    </div>
  );
}