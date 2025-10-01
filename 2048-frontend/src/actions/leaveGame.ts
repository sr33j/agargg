import { publicClient, getWalletClient } from '../utils/client';
import AgarGameAbi from '../contracts/abi/AgarGame.json';
import {
  AGAR_GAME_ADDRESS,
  FUND_TRANSFER_TIMEOUT_ATTEMPTS,
  FUND_TRANSFER_RETRY_DELAY
} from '../constants';
import { getTransactionDeadline, waitForTransaction } from './utils/transactionHelper';
import { gasManager, GasUrgency } from '../services/simpleGasManager';

export interface LeaveGameParams {
  userAddress: string;
  privyProvider: any;
  onProgress?: (message: string) => void;
  onError?: (error: string) => void;
}

export async function leaveGame({
  userAddress,
  privyProvider,
  onProgress,
  onError
}: LeaveGameParams) {
  const walletClient = await getWalletClient(privyProvider);

  try {
    onProgress?.('Starting withdrawal process...');

    // Get player's current balance
    const [monAmount] = await publicClient.readContract({
      address: AGAR_GAME_ADDRESS,
      abi: AgarGameAbi,
      functionName: 'players',
      args: [userAddress]
    }) as [bigint, bigint, bigint];

    if (!monAmount || monAmount === 0n) {
      throw new Error('No funds to withdraw');
    }

    onProgress?.('Withdrawing from game contract...');

    // Get fresh block number right before transaction
    const freshBlockNumber = await publicClient.getBlockNumber();
    console.log('🔢 Fresh block number for leave:', freshBlockNumber.toString());

    // Calculate deadline with fresh block number
    const deadline = getTransactionDeadline(freshBlockNumber, 100);

    // Prepare transaction data for gas estimation
    const baseTxParams = {
      account: userAddress as `0x${string}`,
      address: AGAR_GAME_ADDRESS,
      abi: AgarGameAbi,
      functionName: 'leave',
      args: [deadline]
    };

    // Get optimized gas parameters (CRITICAL for withdrawals - must go through)
    const gasParams = await gasManager.getGasParams(baseTxParams, GasUrgency.CRITICAL);

    // Log estimated cost
    const estimatedCost = gasManager.calculateEstimatedCost(gasParams);
    console.log(`⛽ Leave game gas: ${gasParams.gasLimit.toString()}, est. cost: ${gasManager.formatCost(estimatedCost)} MON`);

    // Send leave transaction with optimized gas
    const leaveTx = await walletClient.writeContract({
      ...baseTxParams,
      gas: gasParams.gasLimit,
      maxFeePerGas: gasParams.maxFeePerGas,
      maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas
    });

    console.log(`📤 Leave transaction sent: ${leaveTx}`);
    onProgress?.('Waiting for withdrawal confirmation...');

    // Wait for leave transaction
    const leaveSuccess = await waitForTransaction(leaveTx, 20);
    if (!leaveSuccess) {
      throw new Error('Withdrawal transaction failed or timed out');
    }

    onProgress?.('Withdrawal complete! Waiting for funds...');

    // Poll for funds to arrive in wallet
    let attempts = 0;
    while (attempts < FUND_TRANSFER_TIMEOUT_ATTEMPTS) {
      const balance = await publicClient.getBalance({
        address: userAddress as `0x${string}`
      });

      if (balance > 0n) {
        onProgress?.('Funds received successfully!');
        return {
          success: true,
          txHash: leaveTx,
          balance
        };
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, FUND_TRANSFER_RETRY_DELAY));
    }

    throw new Error('Funds transfer timeout - please check your wallet');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Leave game error:', errorMessage);
    onError?.(errorMessage);
    throw error;
  }
}