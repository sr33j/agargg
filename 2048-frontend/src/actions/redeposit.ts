import { parseUnits } from 'viem';
import { publicClient, getWalletClient } from '../utils/client';
import AgarGameAbi from '../contracts/abi/AgarGame.json';
import { AGAR_GAME_ADDRESS, MON_DECIMALS } from '../constants';
import { getTransactionDeadline, waitForTransaction } from './utils/transactionHelper';
import { gasManager, GasUrgency } from '../services/simpleGasManager';

export interface RedepositParams {
  userAddress: string;
  amount: string; // Amount in MON (will be converted to wei)
  privyProvider: any;
  onProgress?: (message: string) => void;
  onError?: (error: string) => void;
}

export async function redeposit({
  userAddress,
  amount,
  privyProvider,
  onProgress,
  onError
}: RedepositParams) {
  const walletClient = await getWalletClient(privyProvider);

  try {
    // Convert amount to wei
    const amountInWei = parseUnits(amount, MON_DECIMALS);

    // Check wallet balance
    const balance = await publicClient.getBalance({
      address: userAddress as `0x${string}`
    });

    if (balance < amountInWei) {
      throw new Error(`Insufficient balance. Have ${balance}, need ${amountInWei}`);
    }

    onProgress?.(`Redepositing ${amount} MON...`);

    // Get current player state to verify they're in the game
    const [monAmount] = await publicClient.readContract({
      address: AGAR_GAME_ADDRESS,
      abi: AgarGameAbi,
      functionName: 'players',
      args: [userAddress]
    }) as [bigint, bigint, bigint];

    if (!monAmount || monAmount === 0n) {
      throw new Error('You must be in the game to redeposit');
    }

    // Get fresh block number right before transaction
    const freshBlockNumber = await publicClient.getBlockNumber();
    console.log('🔢 Fresh block number for redeposit:', freshBlockNumber.toString());

    // Calculate deadline with fresh block number
    const deadline = getTransactionDeadline(freshBlockNumber, 100);

    // Prepare transaction data for gas estimation
    const baseTxParams = {
      account: userAddress as `0x${string}`,
      address: AGAR_GAME_ADDRESS,
      abi: AgarGameAbi,
      functionName: 'redeposit',
      args: [amountInWei, deadline],
      value: amountInWei
    };

    // Get optimized gas parameters (FAST for redeposits)
    const gasParams = await gasManager.getGasParams(baseTxParams, GasUrgency.FAST);

    // Log estimated cost
    const estimatedCost = gasManager.calculateEstimatedCost(gasParams);
    console.log(`⛽ Redeposit gas: ${gasParams.gasLimit.toString()}, est. cost: ${gasManager.formatCost(estimatedCost)} MON`);

    const tx = await walletClient.writeContract({
      ...baseTxParams,
      gas: gasParams.gasLimit,
      maxFeePerGas: gasParams.maxFeePerGas,
      maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas
    });

    console.log(`📤 Redeposit transaction sent: ${tx}`);
    onProgress?.('Waiting for confirmation...');

    // Wait for transaction
    const success = await waitForTransaction(tx, 20);
    if (!success) {
      throw new Error('Redeposit transaction failed or timed out');
    }

    onProgress?.('Redeposit successful!');

    // Fetch updated player state
    const [updatedMonAmount] = await publicClient.readContract({
      address: AGAR_GAME_ADDRESS,
      abi: AgarGameAbi,
      functionName: 'players',
      args: [userAddress]
    }) as [bigint, bigint, bigint];

    return {
      success: true,
      txHash: tx,
      newMonAmount: updatedMonAmount
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Redeposit error:', errorMessage);
    onError?.(errorMessage);
    throw error;
  }
}