import { config } from '../config.js';

class ConnectionMonitor {
  constructor(blockchainConnection, io) {
    this.blockchain = blockchainConnection;
    this.io = io;
    this.healthCheckInterval = null;
  }

  start() {
    // Clear any existing interval
    this.stop();

    this.healthCheckInterval = setInterval(async () => {
      if (!this.blockchain.isConnected || !this.blockchain.wsProvider) {
        return;
      }

      try {
        // Test connection by making a simple call
        await this.blockchain.wsProvider.getBlockNumber();
      } catch (error) {
        console.error('🔴 Connection health check failed:', error.message);
        this.blockchain.isConnected = false;
        this.io.emit('connection-status', { connected: false });

        // Stop monitoring
        this.stop();

        // Clean up current provider
        this.blockchain.cleanup();

        // Attempt to reconnect
        console.log('🔄 Attempting to reconnect...');
        setTimeout(() => this.blockchain.initialize(), config.reconnectDelay);
      }
    }, config.healthCheckInterval);

    console.log('🏥 Connection health monitoring started');
  }

  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export default ConnectionMonitor;