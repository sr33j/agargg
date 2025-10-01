import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config.js';
import setupAlchemyProxy from './services/alchemyProxy.js';
import BlockchainConnection from './services/blockchain.js';
import ConnectionMonitor from './services/connectionMonitor.js';
import SocketHandler from './websocket/socketHandler.js';

class GameServer {
  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new Server(this.httpServer, {
      cors: {
        origin: config.frontendUrl,
        methods: ['GET', 'POST']
      }
    });

    // Initialize services
    this.blockchain = new BlockchainConnection(this.io);
    this.connectionMonitor = new ConnectionMonitor(this.blockchain, this.io);
    this.socketHandler = new SocketHandler(this.io, this.blockchain);
  }

  setupMiddleware() {
    this.app.use(cors({ origin: config.frontendUrl }));
    this.app.use(express.json());
  }

  setupRoutes() {
    // Setup Alchemy proxy endpoint
    setupAlchemyProxy(this.app);

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json(this.blockchain.getConnectionStatus());
    });
  }

  async start() {
    // Setup middleware and routes
    this.setupMiddleware();
    this.setupRoutes();

    // Setup WebSocket handlers
    this.socketHandler.setupHandlers();

    // Start HTTP server
    this.httpServer.listen(config.port, () => {
      console.log(`🚀 Unified server running on http://localhost:${config.port}`);
      console.log('📡 WebSocket server ready for connections');

      // Initialize blockchain connection
      this.blockchain.initialize().then(() => {
        // Start connection monitoring after successful connection
        this.connectionMonitor.start();
      });
    });
  }

  async shutdown() {
    console.log('\n🛑 Shutting down server...');

    // Stop connection monitoring
    this.connectionMonitor.stop();

    // Close WebSocket connections
    this.io.close();

    // Close blockchain connection
    this.blockchain.cleanup();

    // Close HTTP server
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log('✅ Server shut down gracefully');
        resolve();
      });
    });
  }
}

export default GameServer;