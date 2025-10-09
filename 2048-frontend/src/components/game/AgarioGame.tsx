import { useState, useEffect, useCallback } from 'react';
import { publicClient } from '../../utils/client';
import AgarGameAbi from '../../contracts/abi/AgarGame.json';
import { 
  AGAR_GAME_ADDRESS,
  MAX_PENDING_MOVES,
  DEFAULT_MOVE_PRIORITY_FEE_GWEI
} from '../../constants';
import { useBlockchain } from '../../hooks/useBlockchain';
import { useTransactionManager } from '../../hooks/useTransactionManager';
import { AgarioGameProps, Direction } from '../../types';

// Actions
import { movePlayer, leaveGame, redeposit } from '../../actions';

// Components
import { GameCanvas } from './GameCanvas';
import { GameControls } from './GameControls';
import { RedepositModal } from '../RedepositModal';

// Hooks
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { useOptimisticState } from './state/OptimisticState';
import { useBalance } from '../../hooks/useBalance';

interface ExtendedAgarioGameProps extends AgarioGameProps {
  onLeaveComplete?: () => void;
  setJoined: (value: boolean) => void;
  fullSyncFromContract: () => Promise<void>;
}

export function AgarioGame({
  userAddress,
  allPlayers,
  contractBoardWidth,
  contractBoardHeight,
  privyProvider,
  onLeaveComplete,
  setJoined,
  fullSyncFromContract
}: ExtendedAgarioGameProps) {
  // State
  const [withdrawing, setWithdrawing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRedepositModal, setShowRedepositModal] = useState(false);
  const [movePriorityFeeGwei, setMovePriorityFeeGwei] = useState(DEFAULT_MOVE_PRIORITY_FEE_GWEI);

  // Contract parameters
  const [moveFee, setMoveFee] = useState<bigint>(0n);
  const [minMonAmount, setMinMonAmount] = useState<bigint>(0n);
  const [maxMonAmount, setMaxMonAmount] = useState<bigint>(1000n);
  const [velocityMin, setVelocityMin] = useState<number>(100);
  const [velocityMax, setVelocityMax] = useState<number>(500);

  // Use blockchain hook
  const { trackTransaction, pendingTransactions } = useBlockchain();

  // Use transaction manager for nonce management
  const { getNonce, incrementNonce, isInitialized: nonceInitialized } = useTransactionManager(userAddress);

  // Use shared balance hook
  const { balance: walletBalance } = useBalance(userAddress);

  // Get current player
  const currentPlayerAddress = userAddress.toLowerCase();
  const currentPlayer = allPlayers.find(
    p => p.address.toLowerCase() === currentPlayerAddress
  );
  const currentPosition = currentPlayer
    ? { x: Number(currentPlayer.x), y: Number(currentPlayer.y) }
    : null;

  // Debug: Log when confirmed state changes
  useEffect(() => {
    if (currentPlayer) {
      console.log(`🟢 Confirmed state updated for ${currentPlayerAddress}:`, {
        position: { x: Number(currentPlayer.x), y: Number(currentPlayer.y) },
        monAmount: currentPlayer.monAmount.toString()
      });
    }
  }, [currentPlayer?.x, currentPlayer?.y, currentPlayer?.monAmount, currentPlayerAddress]);

  // Use optimistic state
  const {
    queuedMoves,
    optimisticPosition,
    addQueuedMove,
    clearQueuedMoves
  } = useOptimisticState({
    currentPosition,
    monAmount: currentPlayer?.monAmount || 0n,
    boardWidth: contractBoardWidth,
    boardHeight: contractBoardHeight,
    velocityMin,
    velocityMax,
    minMonAmount,
    maxMonAmount,
    pendingTransactions
  });

  // Debug: Log when optimistic state changes
  useEffect(() => {
    if (optimisticPosition) {
      console.log(`🔮 Optimistic state updated for ${currentPlayerAddress}:`, {
        position: optimisticPosition,
        pendingMoves: queuedMoves.length
      });
    }
  }, [optimisticPosition?.x, optimisticPosition?.y, queuedMoves.length, currentPlayerAddress]);

  // Fetch contract parameters
  useEffect(() => {
    async function fetchContractParams() {
      try {
        const [fee, minMon, maxMon, vMin, vMax] = await Promise.all([
          publicClient.readContract({
            address: AGAR_GAME_ADDRESS,
            abi: AgarGameAbi,
            functionName: 'moveFee',
          }) as Promise<bigint>,
          publicClient.readContract({
            address: AGAR_GAME_ADDRESS,
            abi: AgarGameAbi,
            functionName: 'minMonAmount',
          }) as Promise<bigint>,
          publicClient.readContract({
            address: AGAR_GAME_ADDRESS,
            abi: AgarGameAbi,
            functionName: 'getMaxSize',
          }) as Promise<bigint>,
          publicClient.readContract({
            address: AGAR_GAME_ADDRESS,
            abi: AgarGameAbi,
            functionName: 'velocityMin',
          }) as Promise<bigint>,
          publicClient.readContract({
            address: AGAR_GAME_ADDRESS,
            abi: AgarGameAbi,
            functionName: 'velocityMax',
          }) as Promise<bigint>,
        ]);

        setMoveFee(fee);
        setMinMonAmount(minMon);
        setMaxMonAmount(maxMon);
        setVelocityMin(Number(vMin));
        setVelocityMax(Number(vMax));
      } catch (error) {
        console.error('Failed to fetch contract params:', error);
      }
    }

    fetchContractParams();
  }, []);

  // Handle move with non-blocking fire-and-forget pattern
  const handleMove = useCallback((direction: Direction) => {
    // Check basic validity
    if (!currentPlayer || !currentPosition) {
      console.warn('Player not found');
      return;
    }

    if (!nonceInitialized) {
      console.warn('Nonce not initialized yet');
      return;
    }

    // Limit pending transactions to prevent spam
    const pendingMoveCount = pendingTransactions.filter(tx => tx.action === 'move').length;
    if (pendingMoveCount >= MAX_PENDING_MOVES) {
      console.warn(`⏸️ Too many pending moves (${pendingMoveCount}/${MAX_PENDING_MOVES}). Wait for confirmation.`);
      setError(`Too many pending moves (${pendingMoveCount}). Wait for confirmation.`);
      setTimeout(() => setError(null), 2000);
      return;
    }

    // Check funds
    if (currentPlayer.monAmount <= moveFee) {
      console.warn('Insufficient funds to move');
      setError('Insufficient funds to move');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Get current nonce and increment for next transaction
    const nonce = getNonce();
    incrementNonce();

    // Add optimistic move immediately (will be updated with txHash)
    const tempTxHash = `temp-${Date.now()}-${direction}`;
    addQueuedMove(direction, tempTxHash);

    console.log(`🎯 Sending move: direction=${direction}, nonce=${nonce}`);

    // Send transaction (non-blocking)
    movePlayer({
      userAddress,
      direction,
      privyProvider,
      deadlineBlocks: 10,
      nonce,
      priorityFeeGwei: movePriorityFeeGwei
    })
      .then((result) => {
        // Transaction sent successfully
        console.log(`✅ Move transaction sent: ${result.txHash}`);

        // Track transaction with direction and nonce
        trackTransaction(result.txHash, result.deadline, 'move', direction, nonce);

        // Update the temporary txHash with the real one
        // OptimisticState will handle this via pendingTransactions integration
      })
      .catch((error) => {
        // Transaction failed to send - don't reset nonce
        // Let subsequent transactions continue with their nonces
        console.error('Move transaction failed:', error);
        setError('Failed to send move transaction');
        setTimeout(() => setError(null), 3000);
      });
  }, [
    currentPlayer,
    currentPosition,
    moveFee,
    userAddress,
    privyProvider,
    addQueuedMove,
    trackTransaction,
    getNonce,
    incrementNonce,
    nonceInitialized,
    pendingTransactions,
    movePriorityFeeGwei
  ]);

  // Handle leave game
  const handleLeaveGame = useCallback(async () => {
    setWithdrawing(true);
    setError(null);

    try {
      const result = await leaveGame({
        userAddress,
        privyProvider,
        onProgress: setProgress,
        onError: setError
      });

      if (result.success) {
        setProgress('Successfully left the game!');
        console.log('🎮 Leave game successful, syncing from contract...');

        // Do full sync from contract to get updated state
        await fullSyncFromContract();

        // Trigger the completion callback
        if (onLeaveComplete) {
          onLeaveComplete();
        }
      }
    } catch (error) {
      console.error('Leave game failed:', error);
    } finally {
      setWithdrawing(false);
    }
  }, [userAddress, privyProvider, onLeaveComplete, fullSyncFromContract]);

  // Handle redeposit
  const handleRedeposit = useCallback(async (amount: string) => {
    try {
      await redeposit({
        userAddress,
        amount,
        privyProvider,
        onProgress: setProgress,
        onError: setError
      });

      setShowRedepositModal(false);
      setProgress('Redeposit successful!');
      setTimeout(() => setProgress(null), 3000);
    } catch (error) {
      console.error('Redeposit failed:', error);
    }
  }, [userAddress, privyProvider]);

  // Use keyboard controls
  useKeyboardControls({
    onMove: handleMove,
    onLeave: handleLeaveGame,
    onRedeposit: () => setShowRedepositModal(true),
    enabled: !withdrawing && !showRedepositModal
  });

  // Don't automatically clear on every position update
  // Let the optimistic state handle syncing with pending transactions
  useEffect(() => {
    if (!currentPlayer) {
      // Only clear if player is completely gone (died/left)
      clearQueuedMoves();
    }
  }, [currentPlayer, clearQueuedMoves]);

  if (!currentPlayer) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Player not found in game</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-100">
      {/* Game Canvas - Takes full width on mobile, flex-1 on desktop */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 lg:p-8 min-h-0">
        <GameCanvas
          allPlayers={allPlayers}
          currentPlayerAddress={currentPlayerAddress}
          optimisticPosition={optimisticPosition}
          queuedMoves={queuedMoves}
          contractBoardWidth={contractBoardWidth}
          contractBoardHeight={contractBoardHeight}
        />
      </div>

      {/* Controls Sidebar - Full width on mobile, fixed width on desktop */}
      <div className="w-full lg:w-80 p-2 sm:p-4 space-y-2 sm:space-y-4 bg-white lg:bg-transparent shadow-lg lg:shadow-none overflow-y-auto">
        <GameControls
          onLeave={handleLeaveGame}
          onRedeposit={() => setShowRedepositModal(true)}
          isWithdrawing={withdrawing}
          walletBalance={walletBalance}
          playerMonAmount={currentPlayer.monAmount}
          error={error}
          progress={progress}
          userAddress={userAddress}
          movePriorityFeeGwei={movePriorityFeeGwei}
          setMovePriorityFeeGwei={setMovePriorityFeeGwei}
        />
      </div>

      {showRedepositModal && (
        <RedepositModal
          onClose={() => setShowRedepositModal(false)}
          userAddress={userAddress}
          privyProvider={privyProvider}
          maxMonAmount={maxMonAmount}
          currentMonAmount={currentPlayer.monAmount}
          onSuccess={() => {
            setShowRedepositModal(false);
          }}
        />
      )}
    </div>
  );
}

export default AgarioGame;