// URL configuration derived from environment variables

// Get the RPC URL from environment
export const RPC_URL = import.meta.env.VITE_MONAD_RPC_URL || 'http://localhost:3001/alchemy';

// Derive WebSocket URL by removing the /alchemy suffix if present
export const WEBSOCKET_URL = RPC_URL.replace(/\/alchemy$/, '');

// Export for backward compatibility
export const getWebSocketUrl = () => WEBSOCKET_URL;
export const getRpcUrl = () => RPC_URL;