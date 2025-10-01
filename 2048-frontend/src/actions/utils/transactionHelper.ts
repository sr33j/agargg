import { publicClient } from '../../utils/client';
import {
  TRANSACTION_DEADLINE_BLOCKS,
  NON_URGENT_TRANSACTION_DEADLINE_BLOCKS
} from '../../constants';

export function getTransactionDeadline(
  currentBlockNumber: bigint,
  blocksToAdd: number = TRANSACTION_DEADLINE_BLOCKS
): bigint {
  return currentBlockNumber + BigInt(blocksToAdd);
}

export async function getCurrentNonce(address: string): Promise<number> {
  return await publicClient.getTransactionCount({
    address: address as `0x${string}`,
    blockTag: 'pending'
  });
}

export async function waitForTransaction(
  txHash: string,
  maxWaitBlocks: number = 10
): Promise<boolean> {
  const startBlock = await publicClient.getBlockNumber();
  const maxBlock = startBlock + BigInt(maxWaitBlocks);

  while (true) {
    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`
      });

      if (receipt) {
        return receipt.status === 'success';
      }
    } catch (error) {
      // Transaction not found yet
    }

    const currentBlock = await publicClient.getBlockNumber();
    if (currentBlock > maxBlock) {
      console.log(`⏰ Transaction ${txHash} timed out after ${maxWaitBlocks} blocks`);
      return false;
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

export function isTransactionExpired(
  deadline: bigint,
  currentBlock: bigint
): boolean {
  return currentBlock > deadline;
}