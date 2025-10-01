import transactionTracker from '../state/transactionTracker.js';

export function setupBlockEventListener(wsProvider, io) {
  const handleBlock = async (blockNumber) => {
    console.log(`📦 New block: ${blockNumber}`);
    transactionTracker.updateBlockNumber(blockNumber);

    // Broadcast block update to all clients
    io.emit('block-update', { blockNumber: blockNumber.toString() });

    // Check for expired transactions
    const { expired } = transactionTracker.checkExpiredTransactions(blockNumber);

    // Check for confirmed transactions
    for (const [txHash, txData] of transactionTracker.getPendingTransactions()) {
      try {
        const receipt = await wsProvider.getTransactionReceipt(txHash);
        if (receipt && receipt.status === 1) {
          const confirmedTx = transactionTracker.confirmTransaction(txHash, receipt);
          if (confirmedTx) {
            // Emit confirmation event
            io.emit('transaction-confirmed', {
              txHash,
              action: confirmedTx.action,
              player: confirmedTx.player,
              blockNumber: receipt.blockNumber.toString()
            });
          }
        }
      } catch (error) {
        // Transaction might not exist yet, keep it pending
      }
    }

    // Emit expired transaction events
    for (const expiredTx of expired) {
      io.emit('transaction-expired', {
        txHash: expiredTx.txHash,
        action: expiredTx.action,
        player: expiredTx.player,
        deadline: expiredTx.deadline.toString()
      });
    }
  };

  wsProvider.on('block', handleBlock);

  // Return cleanup function
  return () => {
    wsProvider.off('block', handleBlock);
  };
}

export default setupBlockEventListener;