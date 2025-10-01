import React, { useState, useEffect } from "react";
import { parseUnits, formatUnits } from "viem";
import { publicClient, getWalletClient } from "../utils/client";
import { connectAndGetEOAClient, checkWalletConnection, isOnMonadTestnet } from "../utils/wallet";
import { storeEOAAddress } from "../utils/eoaTracker";
import AgarGameAbi from "../contracts/abi/AgarGame.json";
import { findValidPosition, getRadius } from "../utils/game";
import { useBlockchain } from "../hooks/useBlockchain";
import { 
  AGAR_GAME_ADDRESS, 
  MON_DECIMALS, 
  FUND_TRANSFER_TIMEOUT_ATTEMPTS, 
  FUND_TRANSFER_RETRY_DELAY,
  NON_URGENT_TRANSACTION_DEADLINE_BLOCKS
} from '../constants';
import { DepositAndNameFormProps } from '../types';

export function DepositAndNameForm({ 
  onSuccess, 
  allPlayers, 
  minMonAmount, 
  maxMonAmount, 
  userAddress, 
  privyProvider, 
  contractBoardWidth, 
  contractBoardHeight 
}: DepositAndNameFormProps) {
  const [name, setName] = useState("");
  const [monAmount, setMonAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { trackTransaction } = useBlockchain();
  const [walletConnected, setWalletConnected] = useState(false);
  const [onCorrectNetwork, setOnCorrectNetwork] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(true);

  // Convert human-readable amounts for display
  const minMonDisplay = formatUnits(minMonAmount, MON_DECIMALS);
  const maxMonDisplay = formatUnits(maxMonAmount, MON_DECIMALS);

  // Check wallet connection status on mount
  useEffect(() => {
    async function checkWallet() {
      setCheckingWallet(true);
      const { isConnected } = await checkWalletConnection();
      setWalletConnected(isConnected);
      
      if (isConnected) {
        const onMonad = await isOnMonadTestnet();
        setOnCorrectNetwork(onMonad);
      }
      
      setCheckingWallet(false);
    }
    checkWallet();
  }, []);

  async function getPrivyBalance() {
    // Use viem publicClient to get balance
    return await publicClient.getBalance({ address: userAddress as `0x${string}` });
  }

  async function handleConnectWallet() {
    setError(null);
    setProgress("Connecting to your wallet and switching to Monad testnet...");
    try {
      await connectAndGetEOAClient(); // This now includes network switching
      setWalletConnected(true);
      setOnCorrectNetwork(true);
      setProgress(null);
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
      setProgress(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProgress(null);
    if (!userAddress || !privyProvider) {
      setError("Wallet not connected");
      return;
    }

    if (!name.trim()) {
      setError("Name required");
      return;
    }

    if (!monAmount || isNaN(Number(monAmount))) {
      setError("Please enter a valid MON amount");
      return;
    }

    // Convert human-readable amount to wei
    const amount = parseUnits(monAmount, MON_DECIMALS);
    
    if (amount < minMonAmount || amount > maxMonAmount) {
      setError(`Deposit must be between ${minMonDisplay} and ${maxMonDisplay} MON`);
      return;
    }
    
    const radius = getRadius(amount);
    const pos = findValidPosition(radius, contractBoardWidth, contractBoardHeight, allPlayers, amount);
    if (!pos) {
      setError("Could not find a valid position. Try a different amount or try again.");
      return;
    }
    
    setLoading(true);
    try {
      // 1. Connect to EOA wallet and ensure correct network
      setProgress("Ensuring wallet connection and network...");
      
      // Connect to EOA wallet (this now includes network switching)
      const { client: eoaClient, activeAddress } = await connectAndGetEOAClient();
      setWalletConnected(true);
      setOnCorrectNetwork(true);
      
      console.log("🟡 Starting deposit process");
      console.log("Active EOA Address:", activeAddress);
      console.log("User Address (Privy):", userAddress);
      console.log("Game Contract Address:", AGAR_GAME_ADDRESS);
      console.log("Deposit Amount:", amount.toString());
      
      // Store the EOA address for this Privy wallet for future withdrawals
      storeEOAAddress(userAddress, activeAddress);
      
      // Safety check - make sure we're not sending to the game contract in step 1
      if (userAddress.toLowerCase() === AGAR_GAME_ADDRESS.toLowerCase()) {
        console.error("❌ CRITICAL ERROR: User address (Privy) is the same as game contract address!");
        setError("Critical error: Privy wallet address matches game contract address");
        return;
      }
      
      setProgress("Checking balance and preparing transfer...");
      
      // Check if we have enough balance in EOA
      const eoaBalance = await publicClient.getBalance({ address: activeAddress });
      if (eoaBalance < amount) {
        throw new Error(`Insufficient balance in your wallet. Required: ${formatUnits(amount, MON_DECIMALS)} MON, Available: ${formatUnits(eoaBalance, MON_DECIMALS)} MON`);
      }
      
      setProgress("Transferring funds from your wallet to game wallet...");
      console.log("💰 Step 1: EOA -> Privy wallet transfer");
      console.log("From (EOA):", activeAddress);
      console.log("To (Privy wallet):", userAddress);
      console.log("Amount:", amount.toString());
      
      const step1Tx = await eoaClient.sendTransaction({
        account: activeAddress,
        to: userAddress as `0x${string}`,
        value: amount,
      });
      console.log("✅ Step 1 transaction hash:", step1Tx);
      
      // 2. Wait for Privy wallet to receive funds
      setProgress("Waiting for funds to arrive in game wallet...");
      let retries = 0;
      while (retries < FUND_TRANSFER_TIMEOUT_ATTEMPTS) {
        const bal = await getPrivyBalance();
        console.log(`⏱️ Privy wallet balance check ${retries + 1}/${FUND_TRANSFER_TIMEOUT_ATTEMPTS}:`, bal.toString());
        if (bal >= amount) {
          console.log("✅ Funds arrived in Privy wallet");
          break;
        }
        await new Promise(res => setTimeout(res, FUND_TRANSFER_RETRY_DELAY));
        retries++;
      }
      
      if (retries >= FUND_TRANSFER_TIMEOUT_ATTEMPTS) {
        throw new Error("Timeout waiting for funds to arrive in Privy wallet");
      }
      
      // 3. Call enter from Privy wallet
      setProgress("Joining game...");
      console.log("🎮 Step 2: Privy wallet -> Game contract");
      console.log("From (Privy wallet):", userAddress);
      console.log("To (Game contract):", AGAR_GAME_ADDRESS);
      
      const client = getWalletClient(privyProvider);

      // Get deadline from same RPC just-in-time to avoid "Expired" errors
      const currentBlock = await publicClient.getBlockNumber();
      const deadline = currentBlock + BigInt(NON_URGENT_TRANSACTION_DEADLINE_BLOCKS);

      console.log("🔍 Final transaction parameters:", {
        address: AGAR_GAME_ADDRESS,
        abi: AgarGameAbi,
        functionName: "enter",
        args: [amount, pos.x, pos.y, deadline],
        account: userAddress as `0x${string}`,
        value: amount
      });
      
      // Safety check
      if (deadline <= currentBlock) {
        throw new Error("Computed expired deadline");
      }
      
      console.log("Enter deadline:", deadline.toString(), "current block:", currentBlock.toString());
      
      const step2Tx = await client.writeContract({
        address: AGAR_GAME_ADDRESS,
        abi: AgarGameAbi,
        functionName: "enter",
        args: [amount, pos.x, pos.y, deadline],
        account: userAddress as `0x${string}`,
        value: amount,
      });
      console.log("✅ Step 2 transaction hash:", step2Tx);
      
      // Track the transaction for deadline monitoring
      trackTransaction(step2Tx, deadline, 'enter');
      setLoading(false);
      setProgress(null);
      onSuccess(name, amount, pos.x, pos.y);
    } catch (err: any) {
      console.error("❌ Deposit error:", err);
      setError(err?.shortMessage || err?.message || "Failed to deposit and join game");
      setLoading(false);
      setProgress(null);
    }
  }

  const isReady = walletConnected && onCorrectNetwork;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 100, gap: 16 }}>
      <h2>Enter your name and deposit MON to play</h2>
      
      {/* Wallet Connection Status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 240 }}>
        <div style={{ padding: 12, borderRadius: 8, background: walletConnected ? '#d4edda' : '#f8d7da', color: walletConnected ? '#155724' : '#721c24', fontSize: 14, textAlign: 'center' }}>
          {checkingWallet ? (
            "Checking wallet connection..."
          ) : walletConnected ? (
            "✅ Wallet Connected"
          ) : (
            "❌ Wallet Not Connected"
          )}
        </div>
        
        {walletConnected && (
          <div style={{ padding: 12, borderRadius: 8, background: onCorrectNetwork ? '#d4edda' : '#fff3cd', color: onCorrectNetwork ? '#155724' : '#856404', fontSize: 14, textAlign: 'center' }}>
            {onCorrectNetwork ? (
              "✅ Monad Testnet"
            ) : (
              "⚠️ Wrong Network"
            )}
          </div>
        )}
      </div>
      
      {/* Connect Wallet Button (if not ready) */}
      {!isReady && !checkingWallet && (
        <button 
          type="button"
          onClick={handleConnectWallet}
          disabled={loading || !!progress}
          style={{ 
            padding: '8px 16px', 
            fontSize: 14, 
            borderRadius: 8, 
            background: '#ffc107', 
            color: '#212529', 
            border: 'none', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            marginBottom: 8
          }}
        >
          {!walletConnected ? 'Connect Wallet' : 'Switch to Monad Testnet'}
        </button>
      )}
      
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        style={{ padding: 8, fontSize: 16, borderRadius: 8, border: '1px solid #ccc', width: 240 }}
        disabled={loading}
      />
      <input
        type="number"
        placeholder={`Deposit amount (${minMonDisplay} - ${maxMonDisplay} MON)`}
        value={monAmount}
        onChange={e => setMonAmount(e.target.value)}
        style={{ padding: 8, fontSize: 16, borderRadius: 8, border: '1px solid #ccc', width: 240 }}
        step="0.000000000000000001"
        min={minMonDisplay}
        max={maxMonDisplay}
        disabled={loading}
      />
      <div style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
        Min: {minMonDisplay} MON, Max: {maxMonDisplay} MON
      </div>
      <button 
        type="submit" 
        disabled={loading || !isReady} 
        style={{ 
          padding: '10px 24px', 
          fontSize: 16, 
          borderRadius: 8, 
          background: isReady ? '#6cf' : '#ccc', 
          color: '#fff', 
          border: 'none', 
          fontWeight: 'bold', 
          cursor: isReady ? 'pointer' : 'not-allowed' 
        }}
      >
        {loading ? (progress || 'Depositing...') : isReady ? 'Deposit & Play' : 'Connect Wallet & Switch Network'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 8, textAlign: 'center', maxWidth: 300 }}>{error}</div>}
      {progress && <div style={{ color: '#007bff', marginTop: 8, textAlign: 'center' }}>{progress}</div>}
    </form>
  );
} 