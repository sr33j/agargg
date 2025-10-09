// Smart contract address
export const AGAR_GAME_ADDRESS = "0x52599D9b45f876a70241905bf9F17bc060B51aFb";
export const AGAR_FACTORY_ADDRESS = "0x3b6D975Bbd153D78581b0e28F27F4EEdBf1393bB";
// Game board dimensions (UI) - These are now used as defaults/fallbacks
// Actual canvas size is determined dynamically based on viewport
export const DEFAULT_BOARD_WIDTH = 800;
export const DEFAULT_BOARD_HEIGHT = 800;

// Token configuration
export const MON_DECIMALS = 18; // MON token decimals

// Game configuration - OPTIMIZED POLLING FREQUENCIES
export const GAME_STATE_REFRESH_INTERVAL = 5000; // 5 seconds (was 500ms - 10x reduction!)
export const BALANCE_REFRESH_INTERVAL = 10000; // 10 seconds for balance updates
export const MAX_POSITION_ATTEMPTS = 20;
export const FUND_TRANSFER_TIMEOUT_ATTEMPTS = 30;
export const FUND_TRANSFER_RETRY_DELAY = 2000; // 2 seconds

// Movement throttling
export const MOVE_THROTTLE_MS = 800; // Minimum 800ms between move transactions
export const MAX_PENDING_MOVES = 10; // Maximum pending move transactions before blocking new ones

// Blockchain configuration
export const TRANSACTION_DEADLINE_BLOCKS = 20; // T+20 blocks for move transaction deadline
export const NON_URGENT_TRANSACTION_DEADLINE_BLOCKS = 100; // T+100 blocks for enter/leave/redeposit
export const WEBSOCKET_RECONNECT_DELAY = 5000; // 5 seconds
export const WEBSOCKET_HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const BLOCK_POLL_INTERVAL = 5000; // 5 seconds for block number fallback (was 2s)

// Gas configuration for moves
export const DEFAULT_MOVE_PRIORITY_FEE_GWEI = 5;
export const MIN_MOVE_PRIORITY_FEE_GWEI = 1;
export const MAX_MOVE_PRIORITY_FEE_GWEI = 10;

// UI configuration
export const PLAYER_COLORS = {
  CURRENT_PLAYER: '#6cf',
  CURRENT_PLAYER_BORDER: '#0af',
  OTHER_PLAYER: '#aaa',
}; 