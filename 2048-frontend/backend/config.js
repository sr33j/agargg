import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  port: process.env.PORT || 3001,
  alchemyApiKey: process.env.ALCHEMY_API_KEY,
  alchemyHttpUrl: `https://monad-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  alchemyWsUrl: `wss://monad-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  agarGameAddress: "0x52599D9b45f876a70241905bf9F17bc060B51aFb",
  frontendUrl: process.env.AGAR_FRONTEND_URL || 'http://localhost:5173',

  // WebSocket configuration
  reconnectDelay: 5000,
  healthCheckInterval: 30000,

  // Game configuration
  syncRetries: 3,
  syncRetryDelay: 1000,
  rateLimitWindow: 2000, // 2 seconds between sync requests

  // Paths
  abiPath: join(dirname(__dirname), 'src/contracts/abi/AgarGame.json')
};

export default config;