import { useState, useCallback, useEffect } from 'react';
import { Direction, PendingTransaction } from '../../../types';
import { getVelocity } from '../../../utils/game';

interface OptimisticStateProps {
  currentPosition: { x: number; y: number } | null;
  monAmount: bigint;
  boardWidth: number;
  boardHeight: number;
  velocityMin: number;
  velocityMax: number;
  minMonAmount: bigint;
  maxMonAmount: bigint;
  pendingTransactions?: PendingTransaction[];
}

interface PendingMoveItem {
  txHash: string;
  direction: Direction;
  timestamp: number;
}

export function useOptimisticState({
  currentPosition,
  monAmount,
  boardWidth,
  boardHeight,
  velocityMin,
  velocityMax,
  minMonAmount,
  maxMonAmount,
  pendingTransactions
}: OptimisticStateProps) {
  const [pendingMoves, setPendingMoves] = useState<PendingMoveItem[]>([]);
  const [optimisticPosition, setOptimisticPosition] = useState<{ x: number; y: number } | null>(null);

  const calculateNewPosition = useCallback((
    currentPos: { x: number; y: number },
    direction: Direction,
    velocity: number
  ): { x: number; y: number } => {
    let newX = currentPos.x;
    let newY = currentPos.y;

    switch (direction) {
      case Direction.UP:
        newY = Math.max(0, currentPos.y - velocity);
        break;
      case Direction.DOWN:
        newY = Math.min(boardHeight, currentPos.y + velocity);
        break;
      case Direction.LEFT:
        newX = Math.max(0, currentPos.x - velocity);
        break;
      case Direction.RIGHT:
        newX = Math.min(boardWidth, currentPos.x + velocity);
        break;
    }

    return { x: Math.round(newX), y: Math.round(newY) };
  }, [boardWidth, boardHeight]);

  const addQueuedMove = useCallback((direction: Direction, txHash?: string) => {
    const newMove: PendingMoveItem = {
      direction,
      txHash: txHash || '',
      timestamp: Date.now()
    };
    setPendingMoves(prev => [...prev, newMove]);
    return newMove;
  }, []);

  const clearQueuedMoves = useCallback(() => {
    setPendingMoves([]);
    setOptimisticPosition(null);
  }, []);

  const removeQueuedMove = useCallback((txHash: string) => {
    setPendingMoves(prev => prev.filter(move => move.txHash !== txHash));
  }, []);

  // Derive optimisticPosition from confirmed position + pending move list
  useEffect(() => {
    if (!currentPosition) {
      setOptimisticPosition(null);
      return;
    }

    const velocity = getVelocity(
      monAmount,
      minMonAmount,
      maxMonAmount,
      velocityMin,
      velocityMax
    );

    let pos = { ...currentPosition };
    for (const move of pendingMoves) {
      pos = calculateNewPosition(pos, move.direction, velocity);
    }
    setOptimisticPosition(pos);
  }, [currentPosition?.x, currentPosition?.y, pendingMoves, monAmount, minMonAmount, maxMonAmount, velocityMin, velocityMax, calculateNewPosition]);

  // Keep pendingMoves aligned with globally tracked pendingTransactions (filter non-move or removed)
  useEffect(() => {
    if (!pendingTransactions) return;
    const moveTxHashes = new Set(
      pendingTransactions.filter((tx: PendingTransaction) => tx.action === 'move').map((tx: PendingTransaction) => tx.txHash)
    );
    setPendingMoves(prev => prev.filter(m => !m.txHash || moveTxHashes.has(m.txHash)));
  }, [pendingTransactions]);

  // Compute queuedMoves with predicted positions for rendering (dashed circles)
  const queuedMoves = (() => {
    if (!currentPosition) return [] as { predictedPosition: { x: number; y: number } }[];
    const velocity = getVelocity(
      monAmount,
      minMonAmount,
      maxMonAmount,
      velocityMin,
      velocityMax
    );
    let pos = { ...currentPosition };
    const result: { predictedPosition: { x: number; y: number } }[] = [];
    for (const move of pendingMoves) {
      pos = calculateNewPosition(pos, move.direction, velocity);
      result.push({ predictedPosition: { x: pos.x, y: pos.y } });
    }
    return result;
  })();

  return {
    queuedMoves,
    optimisticPosition,
    addQueuedMove,
    clearQueuedMoves,
    removeQueuedMove
  };
}

export default useOptimisticState;