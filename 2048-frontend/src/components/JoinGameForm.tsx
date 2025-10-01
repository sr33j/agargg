import React, { useState } from "react";
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
  onSuccess
}: JoinGameFormProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { trackTransaction } = useBlockchain();

  const minMonDisplay = formatUnits(minMonAmount, MON_DECIMALS);
  const maxMonDisplay = formatUnits(maxMonAmount, MON_DECIMALS);
  const balanceDisplay = formatUnits(privyBalance, MON_DECIMALS);

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
      maxWidth: '400px',
      width: '100%'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Join Game</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Enter Amount (MON)
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
            border: '1px solid #ddd',
            fontSize: '16px'
          }}
          step="0.000000000000000001"
          min={minMonDisplay}
          max={maxJoinableDisplay}
        />
        <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
          Min: {minMonDisplay} MON | Max: {maxJoinableDisplay} MON
        </div>
        <div style={{ marginTop: '4px', fontSize: '14px', color: '#666' }}>
          Your balance: {balanceDisplay} MON
        </div>
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
          fontWeight: 'bold'
        }}
      >
        {loading ? 'Joining...' : 'Join Game'}
      </button>
      
      {privyBalance === 0n && (
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
          You need to deposit MON first
        </div>
      )}
    </div>
  );
}