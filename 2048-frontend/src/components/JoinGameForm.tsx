import { useState } from "react";
import { parseUnits, formatUnits } from "viem";
import { publicClient, getWalletClient } from "../utils/client";
import AgarGameAbi from "../contracts/abi/AgarGame.json";
import { findValidPosition, getRadius } from "../utils/game";
import { useBlockchain } from "../hooks/useBlockchain";
import { AGAR_GAME_ADDRESS, MON_DECIMALS, NON_URGENT_TRANSACTION_DEADLINE_BLOCKS } from "../constants";

interface JoinGameFormProps {
  userAddress: string;
  privyProvider: any;
  privyBalance: bigint;
  allPlayers: any[];
  minMonAmount: bigint;
  maxMonAmount: bigint;
  contractBoardWidth: number;
  contractBoardHeight: number;
  onSuccess: (result: JoinGameResult) => void;
  recommendedGasReserve?: number;
}

interface JoinGameResult {
  success: boolean;
  txHash?: string;
}

export function JoinGameForm({
  userAddress,
  privyProvider,
  privyBalance,
  allPlayers,
  minMonAmount,
  maxMonAmount,
  contractBoardWidth,
  contractBoardHeight,
  onSuccess,
  recommendedGasReserve = 0.5
}: JoinGameFormProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { trackTransaction } = useBlockchain();

  const minMonDisplay = formatUnits(minMonAmount, MON_DECIMALS);
  const maxMonDisplay = formatUnits(maxMonAmount, MON_DECIMALS);
  const balanceDisplay = formatUnits(privyBalance, MON_DECIMALS);
  const balanceInMon = parseFloat(balanceDisplay);
  
  // Calculate remaining balance after deposit
  const depositAmount = amount ? parseFloat(amount) : 0;
  const remainingAfterDeposit = balanceInMon - depositAmount;
  const hasEnoughForGas = remainingAfterDeposit >= recommendedGasReserve;
  const isLowOnGas = remainingAfterDeposit >= recommendedGasReserve * 0.5 && remainingAfterDeposit < recommendedGasReserve;

  async function handleJoinGame() {
    if (!amount || isNaN(Number(amount))) {
      setError("Please enter a valid amount");
      return;
    }

    const joinAmount = parseUnits(amount, MON_DECIMALS);
    
    if (joinAmount < minMonAmount || joinAmount > maxMonAmount) {
      setError(`Amount must be between ${minMonDisplay} and ${maxMonDisplay} MON`);
      return;
    }

    if (joinAmount > privyBalance) {
      setError(`Insufficient balance. You have ${balanceDisplay} MON`);
      return;
    }
    
    // Warn if gas reserve is too low
    if (remainingAfterDeposit < recommendedGasReserve * 0.3) {
      setError(`You need to leave at least ${(recommendedGasReserve * 0.3).toFixed(2)} MON for gas. You'll have ${remainingAfterDeposit.toFixed(4)} MON remaining.`);
      return;
    }

    const radius = getRadius(joinAmount);
    const pos = findValidPosition(radius, contractBoardWidth, contractBoardHeight, allPlayers, joinAmount);
    
    if (!pos) {
      setError("Could not find a valid position. Try a different amount or try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getWalletClient(privyProvider);
      
      console.log("Joining game with:", {
        amount: joinAmount.toString(),
        position: pos,
        address: userAddress
      });

      // Get deadline using block number (contract expects block number in Monad)
      const currentBlock = await publicClient.getBlockNumber();
      const deadline = currentBlock + BigInt(NON_URGENT_TRANSACTION_DEADLINE_BLOCKS);
      
      // Safety check
      if (deadline <= currentBlock) {
        throw new Error("Computed expired deadline");
      }
      
      console.log("=== ENTER GAME TRANSACTION DETAILS ===");
      console.log("Current block number:", currentBlock.toString());
      console.log("NON_URGENT_TRANSACTION_DEADLINE_BLOCKS:", NON_URGENT_TRANSACTION_DEADLINE_BLOCKS);
      console.log("Calculated deadline (block number):", deadline.toString());
      console.log("Time buffer (blocks):", (deadline - currentBlock).toString());
      console.log("Join amount (wei):", joinAmount.toString());
      console.log("Join amount (MON):", formatUnits(joinAmount, MON_DECIMALS));
      console.log("Position X:", pos.x.toString());
      console.log("Position Y:", pos.y.toString());
      console.log("User address:", userAddress);
      console.log("Contract address:", AGAR_GAME_ADDRESS);
      console.log("Value being sent (wei):", joinAmount.toString());
      console.log("=========================================");

      console.log("=== CONTRACT CALL ARGUMENTS ===");
      console.log("Function: enter");
      console.log("Args[0] monAmount:", joinAmount.toString());
      console.log("Args[1] x:", pos.x.toString());
      console.log("Args[2] y:", pos.y.toString());
      console.log("Args[3] deadline:", deadline.toString());
      console.log("Value (ETH/MON):", joinAmount.toString());
      console.log("Account:", userAddress);
      console.log("================================");

      const txHash = await client.writeContract({
        address: AGAR_GAME_ADDRESS,
        abi: AgarGameAbi,
        functionName: "enter",
        args: [joinAmount, pos.x, pos.y, deadline],
        account: userAddress as `0x${string}`,
        value: joinAmount,
      });

      console.log("Join game transaction hash:", txHash);

      // Track the transaction for deadline monitoring
      trackTransaction(txHash, deadline, 'enter');

      // Wait for transaction confirmation
      console.log("🕗 Waiting for transaction confirmation...");
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });

      if (receipt.status === 'success') {
        console.log("✅ Transaction confirmed!");
        setLoading(false);
        onSuccess({ success: true, txHash });
      } else {
        throw new Error("Transaction failed");
      }
    } catch (err: any) {
      console.error("Join game error:", err);
      setError(err?.shortMessage || err?.message || "Failed to join game");
      setLoading(false);
    }
  }

  const maxJoinable = privyBalance < maxMonAmount ? privyBalance : maxMonAmount;
  const maxJoinableDisplay = formatUnits(maxJoinable, MON_DECIMALS);

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '32px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      maxWidth: '450px',
      width: '100%'
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        marginBottom: '8px',
        color: '#667eea',
        fontSize: '24px'
      }}>
        Enter Game
      </h2>
      <p style={{
        textAlign: 'center',
        fontSize: '14px',
        color: '#666',
        marginBottom: '24px'
      }}>
        Deposit from your embedded wallet into the game
      </p>
      
      {/* Balance Overview */}
      <div style={{
        background: '#f8f9fa',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '14px', color: '#666' }}>Embedded Wallet:</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            {balanceDisplay} MON
          </span>
        </div>
        {depositAmount > 0 && (
          <>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #e0e0e0'
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Game Deposit:</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#667eea' }}>
                -{depositAmount.toFixed(4)} MON
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #e0e0e0'
            }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Remaining for Gas:</span>
              <span style={{ 
                fontSize: '18px', 
                fontWeight: 'bold',
                color: !hasEnoughForGas ? '#dc3545' : isLowOnGas ? '#ffc107' : '#28a745'
              }}>
                {remainingAfterDeposit.toFixed(4)} MON
              </span>
            </div>
            {!hasEnoughForGas && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                background: '#fee',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#c00'
              }}>
                ⚠️ Need at least {recommendedGasReserve} MON for gas!
              </div>
            )}
            {isLowOnGas && hasEnoughForGas && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                background: '#fff3cd',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#856404'
              }}>
                ⚠️ Low on gas. Recommended: {recommendedGasReserve} MON
              </div>
            )}
            {hasEnoughForGas && !isLowOnGas && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                background: '#d4edda',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#155724'
              }}>
                ✓ Good! You have enough for gas
              </div>
            )}
          </>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
          Amount to Deposit (MON)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`${minMonDisplay} - ${maxJoinableDisplay}`}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '2px solid #ddd',
            fontSize: '16px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
          step="0.000000000000000001"
          min={minMonDisplay}
          max={maxJoinableDisplay}
        />
        <div style={{ 
          marginTop: '8px', 
          fontSize: '13px', 
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>Min: {minMonDisplay} MON</span>
          <span>Max: {maxJoinableDisplay} MON</span>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          background: '#fee',
          color: '#c00',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          border: '1px solid #fcc'
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleJoinGame}
        disabled={loading || !amount || privyBalance === 0n}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '8px',
          border: 'none',
          background: loading || !amount || privyBalance === 0n ? '#ccc' : '#667eea',
          color: 'white',
          cursor: loading || !amount || privyBalance === 0n ? 'not-allowed' : 'pointer',
          fontSize: '18px',
          fontWeight: 'bold',
          transition: 'transform 0.2s, background 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!loading && amount && privyBalance > 0n) {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.background = '#5568d3';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading && amount && privyBalance > 0n) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = '#667eea';
          }
        }}
      >
        {loading ? 'Entering Game...' : 'Enter Game'}
      </button>
      
      {privyBalance === 0n && (
        <div style={{ 
          marginTop: '16px', 
          textAlign: 'center', 
          fontSize: '14px', 
          color: '#dc3545',
          fontWeight: '500'
        }}>
          ⚠️ Deposit MON to your embedded wallet first
        </div>
      )}
    </div>
  );
}