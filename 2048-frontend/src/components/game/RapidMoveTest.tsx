import React, { useState } from 'react';
import { Direction } from '../../types';

interface RapidMoveTestProps {
  onMove: (direction: Direction) => void;
  pendingTransactions: number;
}

export function RapidMoveTest({ onMove, pendingTransactions }: RapidMoveTestProps) {
  const [moveCount, setMoveCount] = useState(0);
  const [lastMoveTime, setLastMoveTime] = useState<Date | null>(null);
  const [movesPerSecond, setMovesPerSecond] = useState(0);

  const handleRapidMoves = async () => {
    const startTime = Date.now();
    const moves = [
      Direction.UP,
      Direction.RIGHT,
      Direction.DOWN,
      Direction.LEFT,
      Direction.UP,
      Direction.RIGHT,
      Direction.DOWN,
      Direction.LEFT
    ];

    // Send all moves as fast as possible
    for (const direction of moves) {
      onMove(direction);
      setMoveCount(prev => prev + 1);
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    setMovesPerSecond(moves.length / duration);
    setLastMoveTime(new Date());
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-bold mb-4">Rapid Transaction Test</h3>

      <button
        onClick={handleRapidMoves}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mb-4"
      >
        Send 8 Rapid Moves
      </button>

      <div className="space-y-2 text-sm">
        <div>Total Moves Sent: {moveCount}</div>
        <div>Pending Transactions: {pendingTransactions}</div>
        {movesPerSecond > 0 && (
          <div>Last Test: {movesPerSecond.toFixed(1)} moves/second</div>
        )}
        {lastMoveTime && (
          <div>Last Test Time: {lastMoveTime.toLocaleTimeString()}</div>
        )}
      </div>

      <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
        <div className="font-semibold">Test Instructions:</div>
        <ol className="list-decimal ml-4 mt-2">
          <li>Click "Send 8 Rapid Moves" button</li>
          <li>Watch pending transactions increase immediately</li>
          <li>Observe moves being confirmed on blockchain</li>
          <li>Check that optimistic state updates instantly</li>
        </ol>
      </div>
    </div>
  );
}