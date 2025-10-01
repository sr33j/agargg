import { parseUnits } from 'viem';
import { publicClient, getWalletClient } from '../utils/client';
import AgarGameAbi from '../contracts/abi/AgarGame.json';
import { AGAR_GAME_ADDRESS } from '../constants';
import { Direction } from '../types';
import { getTransactionDeadline } from './utils/transactionHelper';
import { gasManager, GasUrgency } from '../services/simpleGasManager';

export interface MovePlayerParams {
  userAddress: string;
  direction: Direction;
  privyProvider: any;
  deadlineBlocks?: number;
  nonce?: bigint;
}

export async function movePlayer({
  userAddress,
  direction,
  privyProvider,
  deadlineBlocks = 10,
  nonce
}: MovePlayerParams) {
  const walletClient = await getWalletClient(privyProvider);

  // Get fresh block number right before transaction
  const freshBlockNumber = await publicClient.getBlockNumber();
  console.log('🔢 Fresh block number for move:', freshBlockNumber.toString());

  // Calculate deadline immediately with fresh block number
  const deadline = getTransactionDeadline(freshBlockNumber, deadlineBlocks);

  console.log(`🎮 Preparing move transaction:`, {
    direction,
    targetBlock: deadline.toString(),
    nonce: nonce?.toString()
  });

  // Prepare transaction data for gas estimation
  const baseTxParams = {
    account: userAddress as `0x${string}`,
    address: AGAR_GAME_ADDRESS,
    abi: AgarGameAbi,
    functionName: 'move',
    args: [direction, deadline]
  };

  // Get optimized gas parameters
  const gasParams = await gasManager.getGasParams(baseTxParams, GasUrgency.STANDARD);

  // Build final transaction parameters
  const txParams: any = {
    ...baseTxParams,
    gas: gasParams.gasLimit,
    maxFeePerGas: gasParams.maxFeePerGas,
    maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas
  };

  // Add nonce if provided (for rapid sequential transactions)
  if (nonce !== undefined) {
    txParams.nonce = Number(nonce);
  }

  // Log estimated cost
  const estimatedCost = gasManager.calculateEstimatedCost(gasParams);
  console.log(`⛽ Move gas: ${gasParams.gasLimit.toString()}, est. cost: ${gasManager.formatCost(estimatedCost)} MON`);

  // Send transaction (non-blocking)
  const tx = await walletClient.writeContract(txParams);

  console.log(`📤 Move transaction sent: ${tx}`);

  return {
    txHash: tx,
    deadline,
    direction
  };
}