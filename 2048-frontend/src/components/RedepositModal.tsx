import React, { useState, useEffect } from 'react';
import { parseUnits, formatUnits } from 'viem';
import { publicClient, getWalletClient } from '../utils/client';
import AgarGameAbi from '../contracts/abi/AgarGame.json';
import { AGAR_GAME_ADDRESS, NON_URGENT_TRANSACTION_DEADLINE_BLOCKS } from '../constants';
import { useBlockchain } from '../hooks/useBlockchain';
import { RedepositModalProps } from '../types';

export function RedepositModal({
  userAddress,
  privyProvider,
  currentMonAmount,
  maxMonAmount,
  onClose,
  onSuccess
}: RedepositModalProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<bigint>(0n);
  
  const { trackTransaction } = useBlockchain();
  
  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const balance = await publicClient.getBalance({ 
          address: userAddress as `0x${string}` 
        });
        setWalletBalance(balance);
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };
    
    fetchBalance();
  }, [userAddress]);
  
  const maxPossibleDeposit = maxMonAmount - currentMonAmount;
  const maxAffordableDeposit = walletBalance;
  const actualMaxDeposit = maxPossibleDeposit < maxAffordableDeposit ? maxPossibleDeposit : maxAffordableDeposit;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const depositAmountWei = parseUnits(depositAmount, 18);
      
      // Validation
      if (depositAmountWei > actualMaxDeposit) {
        setError(`Maximum deposit amount is ${formatUnits(actualMaxDeposit, 18)} MON`);
        return;
      }
      
      if (depositAmountWei > walletBalance) {
        setError('Insufficient wallet balance');
        return;
      }
      
      if (currentMonAmount + depositAmountWei > maxMonAmount) {
        setError('This deposit would exceed the maximum player size');
        return;
      }
      
      // Get wallet client
      const walletClient = await getWalletClient(privyProvider);
      
      // Get deadline from same RPC just-in-time to avoid "Expired" errors
      const currentBlock = await publicClient.getBlockNumber();
      const deadline = currentBlock + BigInt(NON_URGENT_TRANSACTION_DEADLINE_BLOCKS);
      
      // Safety check
      if (deadline <= currentBlock) {
        throw new Error("Computed expired deadline");
      }
      
      console.log("Redeposit deadline:", deadline.toString(), "current block:", currentBlock.toString());
      
      console.log('🏦 Redepositing:', {
        amount: depositAmount,
        amountWei: depositAmountWei.toString(),
        deadline: deadline.toString(),
        currentAmount: currentMonAmount.toString(),
        newTotal: (currentMonAmount + depositAmountWei).toString()
      });
      
      // Call redeposit function
      const txHash = await walletClient.writeContract({
        address: AGAR_GAME_ADDRESS,
        abi: AgarGameAbi,
        functionName: 'redeposit',
        args: [depositAmountWei, deadline],
        value: depositAmountWei,
        account: userAddress as `0x${string}`,
      });
      
      console.log('✅ Redeposit transaction sent:', txHash);
      
      // Track the transaction
      trackTransaction(txHash, deadline, 'redeposit');
      
      onSuccess();
      
    } catch (err: any) {
      console.error('❌ Redeposit error:', err);
      setError(err?.shortMessage || err?.message || 'Failed to redeposit');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const setMaxDeposit = () => {
    setDepositAmount(formatUnits(actualMaxDeposit, 18));
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
            Redeposit MON
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{ marginBottom: '24px', fontSize: '14px', color: '#666' }}>
          <div>Current size: {formatUnits(currentMonAmount, 18)} MON</div>
          <div>Maximum size: {formatUnits(maxMonAmount, 18)} MON</div>
          <div>Wallet balance: {formatUnits(walletBalance, 18)} MON</div>
          <div>Max deposit: {formatUnits(actualMaxDeposit, 18)} MON</div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Add Amount (MON)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter amount to deposit"
                step="0.000000000000000001"
                min="0"
                max={formatUnits(actualMaxDeposit, 18)}
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: '80px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={setMaxDeposit}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                disabled={isSubmitting}
              >
                MAX
              </button>
            </div>
          </div>
          
          {error && (
            <div style={{
              background: '#fee',
              color: '#c33',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: '#f5f5f5',
                color: '#333',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                padding: '12px',
                background: isSubmitting ? '#ccc' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
              disabled={isSubmitting || actualMaxDeposit <= 0n}
            >
              {isSubmitting ? 'Redepositing...' : 'Redeposit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
