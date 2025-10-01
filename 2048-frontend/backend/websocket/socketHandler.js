import gameState from '../state/gameState.js';
import transactionTracker from '../state/transactionTracker.js';
import { config } from '../config.js';

class SocketHandler {
  constructor(io, blockchainConnection) {
    this.io = io;
    this.blockchain = blockchainConnection;
    this.lastSyncRequest = new Map(); // Client rate limiting
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`👤 Client connected: ${socket.id}`);

      // Send initial status
      this.handleNewConnection(socket);

      // Set up event handlers
      this.setupClientHandlers(socket);
    });
  }

  handleNewConnection(socket) {
    // Send connection status and current block
    socket.emit('connection-status', {
      connected: this.blockchain.isConnected
    });

    socket.emit('block-update', {
      blockNumber: transactionTracker.getCurrentBlockNumber().toString()
    });

    // Send current game state to new client
    const players = gameState.getAllPlayers();
    if (players.length > 0) {
      socket.emit('full-sync', players);
    }
  }

  setupClientHandlers(socket) {
    // Request sync handler with rate limiting
    socket.on('request-sync', async () => {
      console.log(`🔄 Client ${socket.id} requested full sync`);

      // Rate limit sync requests (max once per 2 seconds per client)
      const lastRequest = this.lastSyncRequest.get(socket.id) || 0;
      const now = Date.now();
      if (now - lastRequest < config.rateLimitWindow) {
        console.log(`⏳ Rate limiting sync request from ${socket.id}`);
        return;
      }
      this.lastSyncRequest.set(socket.id, now);

      // Send current state if available
      const players = gameState.getAllPlayers();
      if (players.length > 0) {
        socket.emit('full-sync', players);
      } else {
        // If no state, trigger a fresh sync
        await this.blockchain.syncGameState(1);
      }
    });

    // Transaction tracking handler
    socket.on('track-transaction', (data) => {
      transactionTracker.trackTransaction(data.txHash, data);
    });

    // Heartbeat handler
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`👤 Client disconnected: ${socket.id}`);
      this.lastSyncRequest.delete(socket.id);
    });
  }
}

export default SocketHandler;