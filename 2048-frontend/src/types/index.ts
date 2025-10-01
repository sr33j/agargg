// Directions for player movement
export enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

// Player state for Agar game
export interface PlayerState {
  address: string;
  monAmount: bigint;
  x: bigint;
  y: bigint;
  name?: string;
}

// Props for DepositAndNameForm component
export interface DepositAndNameFormProps {
  onSuccess: (name: string, monAmount: bigint, x: number, y: number) => void;
  allPlayers: PlayerState[];
  minMonAmount: bigint;
  maxMonAmount: bigint;
  userAddress: string;
  privyProvider: any;
  contractBoardWidth: number;
  contractBoardHeight: number;
}

// Props for AgarioGame component
export interface AgarioGameProps {
  userAddress: string;
  allPlayers: PlayerState[];
  contractBoardWidth: number;
  contractBoardHeight: number;
  privyProvider: any;
}

// Hook return types
export interface UseWalletReturn {
  userAddress: string;
  privyProvider: any;
}

export interface UseGameStateReturn {
  allPlayers: PlayerState[];
  joined: boolean;
  setJoined: (value: boolean) => void;
  minMonAmount: bigint;
  maxMonAmount: bigint;
  contractBoardWidth: number;
  contractBoardHeight: number;
  fetchAllPlayers: () => Promise<void>;
  fullSyncFromContract: () => Promise<void>;
}

// Blockchain-related types
export interface PendingTransaction {
  txHash: string;
  deadline: bigint;
  action: string;
  timestamp: number;
  direction?: Direction; // For move transactions
  nonce?: bigint; // Track nonce for debugging
}

export interface UseBlockchainReturn {
  currentBlockNumber: bigint;
  lastBlockUpdate: Date | null;
  isConnected: boolean;
  pendingTransactions: PendingTransaction[];
  trackTransaction: (txHash: string, deadline: bigint, action: string, direction?: Direction, nonce?: bigint) => void;
  getCurrentDeadline: () => bigint;
}

// Props for RedepositModal component
export interface RedepositModalProps {
  userAddress: string;
  privyProvider: any;
  currentMonAmount: bigint;
  maxMonAmount: bigint;
  onClose: () => void;
  onSuccess: () => void;
} 