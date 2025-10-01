import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import gameState from '../state/gameState.js';
import transactionTracker from '../state/transactionTracker.js';
import setupEventListeners from '../events/index.js';

// Load ABI
const AgarGameAbi = JSON.parse(readFileSync(config.abiPath, 'utf8'));

class BlockchainConnection {
  constructor(io) {
    this.io = io;
    this.wsProvider = null;
    this.contract = null;
    this.isConnected = false;
    this.moveFee = 0n;
    this.boardWidth = 20000;
    this.boardHeight = 20000;
    this.eventCleanup = null;  // Store cleanup function for event listeners
    this.isInitializing = false;  // Prevent concurrent initialization
    this.retryTimeout = null;  // Store retry timeout reference
  }

  async initialize() {
    // Prevent concurrent initialization attempts
    if (this.isInitializing) {
      console.log('⚠️ Initialization already in progress, skipping...');
      return;
    }

    this.isInitializing = true;

    try {
      console.log('🔌 Connecting to Monad testnet via WebSocket...');

      // Create WebSocket provider
      this.wsProvider = new ethers.WebSocketProvider(config.alchemyWsUrl);

      // Wait for provider to be ready
      await this.wsProvider._waitUntilReady();

      // Create contract instance
      this.contract = new ethers.Contract(
        config.agarGameAddress,
        AgarGameAbi,
        this.wsProvider
      );

      // Fetch contract constants
      [this.moveFee, this.boardWidth, this.boardHeight] = await Promise.all([
        this.contract.moveFee(),
        this.contract.boardWidth(),
        this.contract.boardHeight()
      ]);

      console.log('📊 Contract constants loaded:', {
        moveFee: this.moveFee.toString(),
        boardWidth: this.boardWidth.toString(),
        boardHeight: this.boardHeight.toString()
      });

      // Get initial block number
      const currentBlockNumber = await this.wsProvider.getBlockNumber();
      transactionTracker.updateBlockNumber(currentBlockNumber);
      console.log(`🔗 Initial block number: ${currentBlockNumber}`);

      // Fetch initial game state
      await this.syncGameState();

      // Set up event listeners and store cleanup function
      this.eventCleanup = setupEventListeners(this.contract, this.wsProvider, this.io, this.moveFee);

      this.isConnected = true;
      this.isInitializing = false;
      console.log('✅ Blockchain connection established');

      // Notify all connected clients
      this.io.emit('connection-status', { connected: true });
      this.io.emit('block-update', {
        blockNumber: transactionTracker.getCurrentBlockNumber().toString()
      });

    } catch (error) {
      console.error('❌ Failed to initialize blockchain connection:', error.message);
      this.isConnected = false;
      this.isInitializing = false;
      this.io.emit('connection-status', { connected: false });

      // Clean up failed provider
      this.cleanup();

      // Retry connection after delay
      console.log('🔄 Retrying connection in 5 seconds...');
      this.retryTimeout = setTimeout(() => this.initialize(), config.reconnectDelay);
    }
  }

  async syncGameState(retries = config.syncRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        await this._performSync();
        break;
      } catch (error) {
        if (i === retries - 1) {
          console.error('❌ Failed to sync after retries');
          throw error;
        } else {
          console.log(`🔄 Retrying sync (${i + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, config.syncRetryDelay));
        }
      }
    }
  }

  async _performSync() {
    // Acquire lock for atomic state updates
    await gameState.acquireLock();

    try {
      console.log('🔄 Syncing game state from blockchain...');

      // Clear existing state
      gameState.clear();

      // Get all active players
      const playerAddresses = await this.contract.getAllPlayers();

      // Fetch each player's state in parallel
      const playerPromises = playerAddresses.map(async (address) => {
        const player = await this.contract.players(address);
        return { address: address.toLowerCase(), player };
      });

      const playerStates = await Promise.all(playerPromises);

      // Update game state
      for (const { address, player } of playerStates) {
        if (player.monAmount > 0n) {
          gameState.setPlayer(address, {
            monAmount: player.monAmount.toString(),
            x: Number(player.x),
            y: Number(player.y)
          });
        }
      }

      console.log(`✅ Synced ${gameState.getPlayerCount()} active players`);

      // Broadcast full state to all clients
      this.io.emit('full-sync', gameState.getAllPlayers());

    } finally {
      gameState.releaseLock();
    }
  }

  cleanup() {
    // Clear any pending retry timeout
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    // Remove all event listeners
    if (this.eventCleanup) {
      try {
        this.eventCleanup();
      } catch (e) {
        console.error('Error cleaning up event listeners:', e);
      }
      this.eventCleanup = null;
    }

    // Destroy WebSocket provider
    if (this.wsProvider) {
      try {
        this.wsProvider.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.wsProvider = null;
    }

    this.contract = null;
    this.isInitializing = false;
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      blockNumber: transactionTracker.getCurrentBlockNumber().toString(),
      playerCount: gameState.getPlayerCount()
    };
  }
}

export default BlockchainConnection;