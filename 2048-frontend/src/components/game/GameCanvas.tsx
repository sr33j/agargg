import React from 'react';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../../constants';
import { PlayerState } from '../../types';

interface GameCanvasProps {
  allPlayers: PlayerState[];
  currentPlayerAddress: string;
  optimisticPosition: { x: number; y: number } | null;
  queuedMoves: Array<{ predictedPosition: { x: number; y: number } }>;
  contractBoardWidth: number;
  contractBoardHeight: number;
}

export function GameCanvas({
  allPlayers,
  currentPlayerAddress,
  optimisticPosition,
  queuedMoves,
  contractBoardWidth,
  contractBoardHeight
}: GameCanvasProps) {
  const canvasRef = useCanvasRenderer({
    allPlayers,
    currentPlayerAddress,
    optimisticPosition,
    queuedMoves,
    contractBoardWidth,
    contractBoardHeight
  });

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        className="border-2 border-gray-800 rounded-lg shadow-lg"
        style={{
          imageRendering: 'crisp-edges',
          background: 'linear-gradient(to bottom right, #f9fafb, #e5e7eb)'
        }}
      />

      {/* Game overlay information */}
      <div className="absolute top-2 left-2 bg-white/90 rounded px-2 py-1 text-xs">
        Players: {allPlayers.length}
      </div>

      {queuedMoves.length > 0 && (
        <div className="absolute top-2 right-2 bg-yellow-100/90 rounded px-2 py-1 text-xs">
          Pending moves: {queuedMoves.length}
        </div>
      )}
    </div>
  );
}

export default GameCanvas;