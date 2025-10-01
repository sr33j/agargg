import { parseUnits } from 'viem';
import { publicClient, getWalletClient } from '../utils/client';
import AgarGameAbi from '../contracts/abi/AgarGame.json';
import {
  AGAR_GAME_ADDRESS,
  MON_DECIMALS,
  MAX_POSITION_ATTEMPTS
} from '../constants';
import { getTransactionDeadline, waitForTransaction } from './utils/transactionHelper';
import { gasManager, GasUrgency } from '../services/simpleGasManager';

export interface EnterGameParams {
  userAddress: string;
  amount: string; // Amount in MON (will be converted to wei)
  privyProvider: any;
  currentBlockNumber: bigint;
  boardWidth: number;
  boardHeight: number;
  existingPlayers: Array<{ x: number; y: number; monAmount: bigint }>;
  onProgress?: (message: string) => void;
  onError?: (error: string) => void;
}

function getRandomPosition(boardWidth: number, boardHeight: number) {
  const margin = Math.min(boardWidth, boardHeight) * 0.1;
  return {
    x: Math.floor(margin + Math.random() * (boardWidth - 2 * margin)),
    y: Math.floor(margin + Math.random() * (boardHeight - 2 * margin))
  };
}

function isPositionSafe(
  position: { x: number; y: number },
  players: Array<{ x: number; y: number; monAmount: bigint }>,
  minDistance: number = 500
): boolean {
  for (const player of players) {
    const distance = Math.sqrt(
      Math.pow(position.x - Number(player.x), 2) +
      Math.pow(position.y - Number(player.y), 2)
    );
    if (distance < minDistance) {
      return false;
    }
  }
  return true;
}

export async function enterGame({
  userAddress,
  amount,
  privyProvider,
  currentBlockNumber,
  boardWidth,
  boardHeight,
  existingPlayers,
  onProgress,
  onError
}: EnterGameParams) {
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

    onProgress?.('Finding safe spawn position...');

    // Find a safe spawn position
    let position = { x: 0, y: 0 };
    let attempts = 0;

    while (attempts < MAX_POSITION_ATTEMPTS) {
      position = getRandomPosition(boardWidth, boardHeight);
      if (isPositionSafe(position, existingPlayers)) {
        break;
      }
      attempts++;
    }

    if (attempts === MAX_POSITION_ATTEMPTS) {
      console.warn('Could not find ideal spawn position, using best effort');
    }

    onProgress?.(`Entering game with ${amount} MON...`);

    // Get fresh block number right before transaction
    const freshBlockNumber = await publicClient.getBlockNumber();
    console.log('🔢 Fresh block number for enter:', freshBlockNumber.toString());
    console.log('🔢 Passed block number:', currentBlockNumber.toString());

    // Calculate deadline with fresh block number
    const deadline = getTransactionDeadline(freshBlockNumber, 100);

    // Prepare transaction data for gas estimation
    const baseTxParams = {
      account: userAddress as `0x${string}`,
      address: AGAR_GAME_ADDRESS,
      abi: AgarGameAbi,
      functionName: 'enter',
      args: [amountInWei, BigInt(position.x), BigInt(position.y), deadline],
      value: amountInWei
    };

    // Get optimized gas parameters (FAST for entering game)
    const gasParams = await gasManager.getGasParams(baseTxParams, GasUrgency.FAST);

    // Log estimated cost
    const estimatedCost = gasManager.calculateEstimatedCost(gasParams);
    console.log(`⛽ Enter game gas: ${gasParams.gasLimit.toString()}, est. cost: ${gasManager.formatCost(estimatedCost)} MON`);

    const tx = await walletClient.writeContract({
      ...baseTxParams,
      gas: gasParams.gasLimit,
      maxFeePerGas: gasParams.maxFeePerGas,
      maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas
    });

    console.log(`📤 Enter game transaction sent: ${tx}`);
    onProgress?.('Waiting for confirmation...');

    // Wait for transaction
    const success = await waitForTransaction(tx, 20);
    if (!success) {
      throw new Error('Enter game transaction failed or timed out');
    }

    onProgress?.('Successfully entered the game!');

    return {
      success: true,
      txHash: tx,
      position,
      amount: amountInWei
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Enter game error:', errorMessage);
    onError?.(errorMessage);
    throw error;
  }
}