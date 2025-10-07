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
    this.lastBlockTime = null;  // Track last block received
    this.blockTimeoutCheck = null;  // Interval to check for stale blocks
    this.errorHandlersAttached = false;  // Track if error handlers are attached
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

      // Add error handlers BEFORE waiting for ready
      this.attachErrorHandlers();

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
      this.lastBlockTime = Date.now();
      console.log(`🔗 Initial block number: ${currentBlockNumber}`);

      // Fetch initial game state
      await this.syncGameState();

      // Set up event listeners and store cleanup function
      this.eventCleanup = setupEventListeners(this.contract, this.wsProvider, this.io, this.moveFee, this);

      // Start block timeout monitoring (check every 15 seconds if we're still receiving blocks)
      this.startBlockTimeoutMonitor();

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

  attachErrorHandlers() {
    if (!this.wsProvider || this.errorHandlersAttached) return;

    // Handle provider-level errors
    this.wsProvider.on('error', (error) => {
      console.error('❌ WebSocket provider error:', error.message || error);
      this.handleConnectionFailure();
    });

    // Handle WebSocket connection close events
    if (this.wsProvider.websocket) {
      this.wsProvider.websocket.on('close', (code, reason) => {
        console.error(`❌ WebSocket closed: code=${code}, reason=${reason || 'no reason provided'}`);
        this.handleConnectionFailure();
      });

      this.wsProvider.websocket.on('error', (error) => {
        console.error('❌ WebSocket connection error:', error.message || error);
      });
    }

    this.errorHandlersAttached = true;
    console.log('✅ WebSocket error handlers attached');
  }

  startBlockTimeoutMonitor() {
    // Clear any existing monitor
    if (this.blockTimeoutCheck) {
      clearInterval(this.blockTimeoutCheck);
    }

    // Check every 15 seconds if we've received a block recently
    this.blockTimeoutCheck = setInterval(() => {
      if (!this.lastBlockTime || !this.isConnected) return;

      const timeSinceLastBlock = Date.now() - this.lastBlockTime;
      const BLOCK_TIMEOUT = 30000; // 30 seconds without a block is concerning

      if (timeSinceLastBlock > BLOCK_TIMEOUT) {
        console.error(`❌ No blocks received for ${Math.floor(timeSinceLastBlock / 1000)}s - reconnecting...`);
        this.handleConnectionFailure();
      }
    }, 15000);

    console.log('✅ Block timeout monitor started');
  }

  handleConnectionFailure() {
    if (!this.isConnected) return; // Already handling failure

    console.log('🔄 Handling connection failure...');
    this.isConnected = false;
    this.io.emit('connection-status', { connected: false });

    // Clean up and reconnect
    this.cleanup();
    this.retryTimeout = setTimeout(() => this.initialize(), config.reconnectDelay);
  }

  // Call this from blockEvent.js when a block is received
  updateLastBlockTime() {
    this.lastBlockTime = Date.now();
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
    // Clear block timeout monitor
    if (this.blockTimeoutCheck) {
      clearInterval(this.blockTimeoutCheck);
      this.blockTimeoutCheck = null;
    }

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
    this.lastBlockTime = null;
    this.errorHandlersAttached = false;
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