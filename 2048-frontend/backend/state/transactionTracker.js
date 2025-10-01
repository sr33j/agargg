// Pending transaction tracking
class TransactionTracker {
  constructor() {
    this.pendingTransactions = new Map(); // txHash -> { deadline, action, player, timestamp }
    this.currentBlockNumber = 0n;
  }

  // Update current block number
  updateBlockNumber(blockNumber) {
    this.currentBlockNumber = BigInt(blockNumber);
  }

  // Get current block number
  getCurrentBlockNumber() {
    return this.currentBlockNumber;
  }

  // Track a new transaction
  trackTransaction(txHash, data) {
    this.pendingTransactions.set(txHash, {
      deadline: BigInt(data.deadline),
      action: data.action,
      player: data.player.toLowerCase(),
      timestamp: Date.now()
    });
    console.log(`📝 Tracking transaction: ${txHash} for ${data.player}`);
  }

  // Get pending transactions
  getPendingTransactions() {
    return this.pendingTransactions;
  }

  // Check for expired transactions
  checkExpiredTransactions(blockNumber) {
    const expired = [];
    const confirmed = [];

    for (const [txHash, txData] of this.pendingTransactions) {
      if (BigInt(blockNumber) > txData.deadline) {
        console.log(`❌ Transaction ${txHash} expired (deadline ${txData.deadline})`);
        expired.push({ txHash, ...txData });
        this.pendingTransactions.delete(txHash);
      }
    }

    return { expired, confirmed };
  }

  // Mark transaction as confirmed
  confirmTransaction(txHash, receipt) {
    const txData = this.pendingTransactions.get(txHash);
    if (txData) {
      console.log(`✅ Transaction ${txHash} confirmed in block ${receipt.blockNumber}`);
      this.pendingTransactions.delete(txHash);
      return txData;
    }
    return null;
  }

  // Remove transaction
  removeTransaction(txHash) {
    this.pendingTransactions.delete(txHash);
  }

  // Clear all transactions
  clear() {
    this.pendingTransactions.clear();
  }
}

// Singleton instance
export const transactionTracker = new TransactionTracker();
export default transactionTracker;