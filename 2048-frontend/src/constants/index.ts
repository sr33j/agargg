// Smart contract address
export const AGAR_GAME_ADDRESS = "0x52599D9b45f876a70241905bf9F17bc060B51aFb";
export const AGAR_FACTORY_ADDRESS = "0x3b6D975Bbd153D78581b0e28F27F4EEdBf1393bB";
// Game board dimensions (UI)
export const BOARD_WIDTH = 800;
export const BOARD_HEIGHT = 800;

// Token configuration
export const MON_DECIMALS = 18; // MON token decimals

// Game configuration
export const GAME_STATE_REFRESH_INTERVAL = 500; // .5 seconds
export const MAX_POSITION_ATTEMPTS = 20;
export const FUND_TRANSFER_TIMEOUT_ATTEMPTS = 30;
export const FUND_TRANSFER_RETRY_DELAY = 2000; // 2 seconds

// Blockchain configuration
export const TRANSACTION_DEADLINE_BLOCKS = 20; // T+20 blocks for move transaction deadline
export const NON_URGENT_TRANSACTION_DEADLINE_BLOCKS = 100; // T+100 blocks for enter/leave/redeposit
export const WEBSOCKET_RECONNECT_DELAY = 5000; // 5 seconds
export const WEBSOCKET_HEARTBEAT_INTERVAL = 30000; // 30 seconds

// UI configuration
export const PLAYER_COLORS = {
  CURRENT_PLAYER: '#6cf',
  CURRENT_PLAYER_BORDER: '#0af',
  OTHER_PLAYER: '#aaa',
}; 